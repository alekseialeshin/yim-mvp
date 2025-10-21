// YIM UI v20251021-11
console.log('YIM UI version', 'v20251021-11');

const $ = (s) => document.querySelector(s);

const fileInput = $('#file');
const recBtn = $('#recBtn');
const playBtn = $('#playBtn');
const analyzeBtn = $('#analyzeBtn');
const meter = $('#meter');
const timerEl = $('#timer');
const fileMetaEl = $('#fileMeta');

const resultBox = $('#result');
const verdictEl = $('#verdict');
const confEl = $('#conf');
const statusEl = $('#status');
const ridEl = $('#rid');
const rawEl = $('#raw');

const waveEl = document.getElementById('wave');
const evidenceEl = document.getElementById('evidence');
const riskStripEl = document.getElementById('riskStrip');
const riskCursorEl = document.getElementById('riskCursor');
const votesEl = document.getElementById('votes');
const metaBadgesEl = document.getElementById('metaBadges');
const summaryCardEl = document.getElementById('summaryCard');

let ws;
let mediaRecorder, recChunks = [];
let currentBlob = null;
let currentAudioBuffer = null;
let tickTimer = null;
let isPlaying = false;
let currentCtrl = null;
let riskTimeline = null; // Float32Array for risk strip

/* ---------- color map (navy → indigo → violet → orange → yellow) ---------- */
function hexToRgb(hex){
  const h = hex.replace('#','');
  const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return [ (n>>16)&255, (n>>8)&255, n&255 ];
}
function lerp(a,b,t){ return a + (b-a)*t; }
function makeGradientColorMap(stops){
  // stops: [[pos(0..1), '#rrggbb'], ...] в порядке возрастания
  const map = new Array(256);
  for (let i=0;i<256;i++){
    const t = i/255;
    // найти соседние стопы
    let j = 0;
    while (j < stops.length-1 && t > stops[j+1][0]) j++;
    const [t0, c0h] = stops[j];
    const [t1, c1h] = stops[Math.min(j+1, stops.length-1)];
    const c0 = hexToRgb(c0h), c1 = hexToRgb(c1h);
    const tt = t1===t0 ? 0 : (t - t0) / (t1 - t0);
    const r = Math.round(lerp(c0[0], c1[0], tt));
    const g = Math.round(lerp(c0[1], c1[1], tt));
    const b = Math.round(lerp(c0[2], c1[2], tt));
    map[i] = [r,g,b,255];
  }
  return map;
}
// тёмно-синий → индиго → фиолетовый → оранжевый → жёлтый
const COLOR_MAP = makeGradientColorMap([
  [0.00, '#081137'], // navy
  [0.25, '#1a3d8f'], // indigo
  [0.50, '#5a2ea4'], // violet
  [0.75, '#f08a25'], // orange
  [1.00, '#ffdc5a'], // yellow
]);

/* ---------- Risk Timeline Computation ---------- */
function computeRiskTimeline(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const length = data.length;
  const duration = length / sampleRate;
  const windowSize = 1024;
  const hopSize = Math.floor(sampleRate / 30);
  const numWindows = Math.floor((length - windowSize) / hopSize) + 1;
  const timeline = new Float32Array(numWindows);

  for (let i = 0; i < numWindows; i++) {
    const start = i * hopSize;
    const end = start + windowSize;
    if (end > length) break;

    // Window the data (Hann window)
    const windowed = new Float32Array(windowSize);
    for (let j = 0; j < windowSize; j++) {
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * j / (windowSize - 1));
      windowed[j] = data[start + j] * w;
    }

    // FFT (simple DFT for low freq)
    const freqData = new Float32Array(windowSize / 2);
    for (let k = 0; k < windowSize / 2; k++) {
      let re = 0, im = 0;
      for (let j = 0; j < windowSize; j++) {
        const angle = -2 * Math.PI * k * j / windowSize;
        re += windowed[j] * Math.cos(angle);
        im += windowed[j] * Math.sin(angle);
      }
      freqData[k] = Math.sqrt(re * re + im * im);
    }

    // Spectral flatness
    let sum = 0, logSum = 0;
    for (let j = 0; j < freqData.length; j++) {
      const val = freqData[j] + 1e-10;
      sum += val;
      logSum += Math.log(val);
    }
    const flatness = Math.exp(logSum / freqData.length) / (sum / freqData.length);

    // Energy in bands
    const binWidth = sampleRate / (2 * freqData.length);
    let eLow = 0, eMid = 0, eHigh = 0;
    for (let j = 0; j < freqData.length; j++) {
      const freq = j * binWidth;
      const energy = freqData[j] * freqData[j];
      if (freq < 300) eLow += energy;
      else if (freq < 3000) eMid += energy;
      else eHigh += energy;
    }
    const hnr = (eLow + eMid + eHigh) > 0 ? (eMid + eHigh) / (eLow + 1e-10) : 0;

    // Normalize
    const flatnessNorm = Math.min(flatness * 10, 1);
    const hnrNorm = Math.min(hnr / 10, 1);
    timeline[i] = (flatnessNorm + hnrNorm) / 2;
  }

  return timeline;
}

/* ---------- Draw Risk Strip ---------- */
function drawRiskStrip(timeline) {
  const canvas = riskStripEl;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.clientWidth;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (!timeline || timeline.length === 0) return;

  const step = width / timeline.length;
  for (let i = 0; i < timeline.length; i++) {
    const risk = timeline[i];
    const colorIndex = Math.floor(risk * 255);
    const [r, g, b] = COLOR_MAP[colorIndex] || [0, 0, 0];
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(i * step, 0, step + 1, height);
  }
}

/* ---------- Update Risk Cursor ---------- */
function updateCursor(currentTime) {
  if (!riskTimeline || riskTimeline.length === 0) return;
  const duration = ws.getDuration();
  const progress = currentTime / duration;
  const canvasWidth = riskStripEl.clientWidth;
  const left = progress * canvasWidth;
  riskCursorEl.style.left = `${left}px`;
}

/* ---------- Fill Evidence Panel ---------- */
function fillMetaBadges(audioBuffer, blob) {
  metaBadgesEl.innerHTML = '';
  if (!audioBuffer || !blob) return;

  const duration = audioBuffer.duration.toFixed(2) + ' s';
  const sampleRate = audioBuffer.sampleRate + ' Hz';
  const codec = blob.type || 'unknown';
  const size = (blob.size / 1024).toFixed(0) + ' KB';
  const bitrate = ((blob.size * 8 / audioBuffer.duration) / 1000).toFixed(0) + ' kbps';

  const badges = [duration, sampleRate, codec, size, bitrate];
  badges.forEach(b => {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = b;
    metaBadgesEl.appendChild(badge);
  });
}

function fillVotes(models) {
  votesEl.innerHTML = '';
  if (!models || models.length === 0) return;

  // Legend
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = '<span class="auth">Authentic</span> <span class="man">Manipulated</span> <span class="inc">Inconclusive</span>';
  votesEl.appendChild(legend);

  models.forEach(model => {
    const vote = document.createElement('div');
    vote.className = 'vote';

    const score = model.score || 0;
    let status, color;
    if (score < 0.33) { status = 'Authentic'; color = '#19c37d'; }
    else if (score > 0.67) { status = 'Manipulated'; color = '#ef4444'; }
    else { status = 'Inconclusive'; color = '#9ca3af'; }

    const bar = document.createElement('div');
    bar.className = 'vote-bar';
    const fill = document.createElement('div');
    fill.className = 'vote-fill';
    fill.style.width = `${score * 100}%`;
    fill.style.backgroundColor = color;
    bar.appendChild(fill);

    const label = document.createElement('span');
    label.className = 'vote-label';
    label.textContent = model.name || 'Unknown';

    const scoreEl = document.createElement('span');
    scoreEl.className = 'vote-score';
    scoreEl.textContent = score.toFixed(3);

    vote.appendChild(label);
    vote.appendChild(bar);
    vote.appendChild(scoreEl);
    votesEl.appendChild(vote);
  });
}

function fillSummaryCard(json) {
  summaryCardEl.innerHTML = '';
  const kv = (key, val) => `<div class="kv"><strong>${key}</strong><span>${val}</span></div>`;
  summaryCardEl.innerHTML = kv('Verdict', json.verdict || '-') +
                            kv('Confidence', json.confidence ? Number(json.confidence).toFixed(3) : '-') +
                            kv('Status', json.status || '-') +
                            kv('Request ID', json.requestId || '-') +
                            kv('Inference Time', json.inferenceTimeMs ? `${json.inferenceTimeMs} ms` : '-');
}

/* ---------- Wavesurfer lifecycle ---------- */
function destroyWS() {
  try { ws?.destroy(); } catch {}
  ws = null;
  waveEl.innerHTML = '';
  riskStripEl.getContext('2d').clearRect(0, 0, riskStripEl.width, riskStripEl.height);
  riskTimeline = null;
  currentAudioBuffer = null;
}
function buildWS() {
  destroyWS();

  ws = WaveSurfer.create({
    container: waveEl,
    height: 110,
    normalize: true,
    waveColor: '#ffffff',
    progressColor: '#c7d2fe',
    cursorColor: '#9dc1ff',
    barWidth: 1,
    barGap: 1,
  });

  ws.on('ready', () => {
    playBtn.disabled = false;
    analyzeBtn.disabled = false;
    setPlay(false);
  });
  ws.on('play',  () => setPlay(true));
  ws.on('pause', () => setPlay(false));
  ws.on('finish', () => setPlay(false));
  ws.on('audioprocess', updateCursor);
  ws.on('error', (e) => { console.error('WaveSurfer error:', e); alert('Audio decode error'); });

  waveEl.onclick = () => (ws.isPlaying() ? ws.pause() : ws.play());
  window.addEventListener('resize', () => { /* no spec to render */ });
}
// init
buildWS();

/* ---------- Utils ---------- */
function setPlay(p){ isPlaying=p; playBtn.textContent = p ? '⏸ Pause' : '▶︎ Play'; }
function setStatus(s){ meter.textContent = s; }
function clearResult(){ 
  resultBox.classList.add('hidden'); 
  rawEl.textContent=''; 
  verdictEl.textContent='-'; 
  confEl.textContent='-'; 
  statusEl.textContent='-'; 
  ridEl.textContent='-';
  votesEl.innerHTML = '';
  metaBadgesEl.innerHTML = '';
  summaryCardEl.innerHTML = '';
}
function stopTick(){ if(tickTimer) clearInterval(tickTimer), tickTimer=null; }
function validateInput(blob, dur){ if(!blob) throw new Error('no audio'); if(blob.size>5*1024*1024) throw new Error('file too large (>5MB)'); if(dur>15) throw new Error('clip too long (>15s)'); }
function setAnalyzing(on){ analyzeBtn.disabled = on; analyzeBtn.textContent = on ? 'Analyzing…' : 'Analyze'; setStatus(on ? 'Analyzing...' : 'Inference Time : ms'); }

function waitReady(timeoutMs=5000){
  return new Promise((resolve,reject)=>{
    try { if (ws && typeof ws.getDuration==='function' && ws.getDuration()>0) return resolve(); } catch {}
    let done=false;
    const finish=(ok,err)=>{ if(done) return; done=true; try { ws?.un('ready', onReady); ws?.un('error', onError); } catch {} ; clearTimeout(t); ok?resolve():reject(err||new Error('ready fail')); };
    const onReady=()=>finish(true);
    const onError=(e)=>finish(false,e);
    try { ws?.once('ready', onReady); ws?.once('error', onError); } catch {}
    const t=setTimeout(()=>{ try{ if(ws?.getDuration()>0) return finish(true);}catch{} finish(false,new Error('wavesurfer ready timeout')); }, timeoutMs);
  });
}

/* ---------- Render from Blob ---------- */
async function renderFromBlob(blob, name='audio.wav'){
  clearResult();
  buildWS();
  currentBlob = blob;

  try {
    await ws.loadBlob(blob);
    await waitReady();

    // Decode audio buffer for risk timeline
    const audioCtx = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    currentAudioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    riskTimeline = computeRiskTimeline(currentAudioBuffer);
    drawRiskStrip(riskTimeline);
    audioCtx.close();
  } catch (e) {
    analyzeBtn.disabled = true; playBtn.disabled = true;
    alert('Failed to load audio');
    console.error(e);
    return;
  }

  const dur = ws.getDuration() || 0;
  try { validateInput(blob, dur); } catch (e) { alert(e.message); return; }
  fileMetaEl.textContent = `${name} · ${(blob.size/1024).toFixed(0)} KB · ${dur.toFixed(2)} s`;
}

/* ---------- File load ---------- */
fileInput.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  await renderFromBlob(f, f.name);
});

/* ---------- Mic record ---------- */
recBtn.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      clearResult();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: (MediaRecorder.isTypeSupported?.('audio/webm') ? 'audio/webm' : '') });
      recChunks = [];
      mediaRecorder.ondataavailable = (ev) => { if (ev.data.size) recChunks.push(ev.data); };
      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(recChunks, { type: 'audio/webm' });
          await renderFromBlob(blob, 'recorded.webm');
        } finally {
          stream.getTracks().forEach(t => t.stop());
          stopTick(); recBtn.textContent = '● REC';
        }
      };
      mediaRecorder.start();
      startTick();
      recBtn.textContent = '■ STOP';
      analyzeBtn.disabled = true; playBtn.disabled = true;
      fileMetaEl.textContent = 'recording...';
    } catch {
      alert('Mic access denied');
    }
  } else {
    mediaRecorder.stop();
  }
});
function startTick(){
  let t=0; timerEl.textContent='00:00';
  stopTick();
  tickTimer=setInterval(()=>{
    t++; const m = String((t/60|0)).padStart(2,'0'); const s=String(t%60).padStart(2,'0');
    timerEl.textContent = `${m}:${s}`;
    if(t>=15 && mediaRecorder?.state==='recording') mediaRecorder.stop();
  },1000);
}

/* ---------- Playback ---------- */
playBtn.addEventListener('click', () => {
  if (!ws) return;
  isPlaying ? ws.pause() : ws.play();
});

/* ---------- Analyze ---------- */
analyzeBtn.addEventListener('click', () => { analyze(); });

async function analyze(){
  if (!currentBlob) { alert('Select or record audio'); return; }

  if (currentCtrl) { try { currentCtrl.abort(); } catch {} }
  currentCtrl = new AbortController();

  setAnalyzing(true);
  clearResult();

  try {
    await waitReady();

    const dur = ws.getDuration() || 0;
    validateInput(currentBlob, dur);

    const name = currentBlob.name || (currentBlob.type.includes('wav') ? 'clip.wav' : 'clip.webm');
    const fd = new FormData(); fd.append('file', currentBlob, name);

    let sec = 0;
    const tick = setInterval(()=>setStatus(`Analyzing... ${++sec}s`), 1000);
    const hardTimeout = setTimeout(()=>currentCtrl.abort('timeout'), 60000);

    const r = await fetch('/analyze', { method:'POST', body: fd, signal: currentCtrl.signal });
    if (!r.ok) {
      const t = await r.text().catch(()=>`HTTP ${r.status}`);
      throw new Error(t);
    }

    const json = await r.json();
    const tMs  = Number(json.inferenceTimeMs ?? 0);
    setStatus(`Inference Time : ${tMs || '—'} ms`);

    verdictEl.textContent = String(json.verdict ?? '-');
    confEl.textContent    = json.confidence==null ? '-' : Number(json.confidence).toFixed(3);
    statusEl.textContent  = String(json.status ?? '-');
    ridEl.textContent     = String(json.requestId ?? '-');
    rawEl.textContent     = JSON.stringify(json, null, 2);
    resultBox.classList.remove('hidden');

    // Fill evidence panel
    fillMetaBadges(currentAudioBuffer, currentBlob);
    fillVotes(json.models || []);
    fillSummaryCard(json);

    // Update risk timeline with ensemble risk
    if (json.confidence != null && riskTimeline) {
      const ensembleRisk = 1 - json.confidence;
      for (let i = 0; i < riskTimeline.length; i++) {
        riskTimeline[i] = (riskTimeline[i] + ensembleRisk) / 2;
      }
      drawRiskStrip(riskTimeline);
    }

    clearInterval(tick);
    clearTimeout(hardTimeout);
  } catch (e) {
    console.error('[UI] analyze error:', e);
    alert(`Analyze failed: ${e?.message || e}`);
  } finally {
    setAnalyzing(false);
    currentCtrl = null;
  }
}