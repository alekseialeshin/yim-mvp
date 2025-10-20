// YIM UI v20251021-08
console.log('YIM UI version', 'v20251021-08');

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
const specEl = document.getElementById('spec');

let ws, spec;
let mediaRecorder, recChunks = [];
let currentBlob = null;
let tickTimer = null;
let isPlaying = false;
let currentCtrl = null;

/* ---------- Wavesurfer lifecycle ---------- */
function destroyWS() {
  try { ws?.destroy(); } catch {}
  ws = null; spec = null;
  waveEl.innerHTML = '';
  specEl.innerHTML = '';
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
  // плагин как в рабочем сниппете
  spec = ws.registerPlugin(WaveSurfer.Spectrogram.create({
    container: specEl,
    labels: false,
    fftSamples: 1024,
    frequencyMin: 0,
    frequencyMax: 8000,
  }));

  ws.on('ready', () => { playBtn.disabled = false; analyzeBtn.disabled = false; setPlay(false); });
  ws.on('play',  () => setPlay(true));
  ws.on('pause', () => setPlay(false));
  ws.on('finish', () => setPlay(false));
  ws.on('error', (e) => { console.error('WaveSurfer error:', e); alert('Audio decode error'); });

  // клик по волне — плей/пауза (как в Bubble)
  waveEl.onclick = () => (ws.isPlaying() ? ws.pause() : ws.play());
}
// первичная инициализация
buildWS();

/* ---------- Utils ---------- */
function setPlay(p){ isPlaying=p; playBtn.textContent = p ? '⏸ Pause' : '▶︎ Play'; }
function setStatus(s){ meter.textContent = s; }
function clearResult(){ resultBox.classList.add('hidden'); rawEl.textContent=''; verdictEl.textContent='-'; confEl.textContent='-'; statusEl.textContent='-'; ridEl.textContent='-'; }
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

/* ---------- Render from Blob (как в Bubble) ---------- */
async function renderFromBlob(blob, name='audio.wav'){
  clearResult();
  buildWS();                           // пересоздать плеер и плагин
  currentBlob = blob;

  try {
    await ws.loadBlob(blob);
    await waitReady();
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

    console.log('[UI] POST /analyze start');
    const r = await fetch('/analyze', { method:'POST', body: fd, signal: currentCtrl.signal });
    console.log('[UI] /analyze HTTP', r.status);

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