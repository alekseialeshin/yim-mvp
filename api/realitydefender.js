// api/realitydefender.js
// Поток: presign → upload → getResult(mediaId)

const RD_API_KEY = process.env.RD_API_KEY;
const RD_BASE = (process.env.RD_BASE || "https://api.prd.realitydefender.xyz").trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function needKey(){ if(!RD_API_KEY) throw new Error("RD_API_KEY is not set"); }

/** 1) Presign с retry. Возвращает signedUrl и mediaId/requestId, если есть */
export async function getPresigned(fileName, { retries = 4, baseDelayMs = 400 } = {}) {
  needKey(); if(!fileName) throw new Error("fileName is required");

  let attempt = 0, lastErr;
  while (attempt <= retries) {
    try {
      const r = await fetch(`${RD_BASE}/api/files/aws-presigned`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": RD_API_KEY },
        body: JSON.stringify({ fileName }),
      });
      const text = await r.text();

      if (!r.ok) {
        if ([429,500,502,503,504].includes(r.status) && attempt < retries) {
          attempt++; await sleep(Math.round(baseDelayMs * Math.pow(1.8, attempt))); continue;
        }
        throw new Error(`Presign failed: ${r.status} ${text}`);
      }

      let json; try { json = JSON.parse(text); } catch { throw new Error(`Bad JSON from presign: ${text}`); }
      const signedUrl = json?.signedUrl || json?.response?.signedUrl;
      if (!signedUrl) throw new Error(`No signedUrl in response: ${text}`);

      const mediaId   = json?.mediaId   || json?.response?.mediaId   || json?.media_id   || json?.response?.media_id;
      const requestId = json?.requestId || json?.response?.requestId || json?.request_id || json?.response?.request_id;

      return { signedUrl, mediaId, requestId, raw: json };
    } catch (e) {
      lastErr = e;
      if (attempt < retries) { attempt++; await sleep(Math.round(baseDelayMs * Math.pow(1.8, attempt))); continue; }
      break;
    }
  }
  throw lastErr || new Error("Presign failed");
}

/** 2) Upload PUT to presigned URL */
export async function uploadToSignedUrl(signedUrl, data, mime="audio/wav", { timeoutMs=20000 } = {}){
  if(!signedUrl) throw new Error("uploadToSignedUrl: signedUrl is required");
  if(!data) throw new Error("uploadToSignedUrl: data is required");

  let body = data;
  if (typeof Blob !== "undefined" && !(data instanceof Blob)) {
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) body = new Blob([data], { type: mime });
    else if (data instanceof Uint8Array) body = new Blob([data], { type: mime });
    else if (data instanceof ArrayBuffer) body = new Blob([new Uint8Array(data)], { type: mime });
  }

  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(new Error("uploadToSignedUrl timeout")), timeoutMs);
  try{
    const r=await fetch(signedUrl,{ method:"PUT", headers:{ "Content-Type": mime }, body, signal: ctl.signal });
    const txt=await r.text().catch(()=> ""); if(!r.ok) throw new Error(`Upload failed: ${r.status} ${txt}`);
    return { status: r.status };
  } finally { clearTimeout(t); }
}

/** 3) Получить результат по mediaId/requestId */
export async function getResult(id, { timeoutMs=20000 } = {}){
  needKey(); if(!id) throw new Error("requestId is required");
  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(new Error("getResult timeout")), timeoutMs);
  try{
    const r=await fetch(`${RD_BASE}/api/media/users/${encodeURIComponent(id)}`, {
      headers:{ "X-API-KEY": RD_API_KEY, "Content-Type":"application/json" },
      signal: ctl.signal
    });
    const text=await r.text(); if(!r.ok) throw new Error(`Result failed: ${r.status} ${text}`);
    let json; try{ json=JSON.parse(text);}catch{ throw new Error(`Bad JSON from result: ${text}`); }
    return json;
  } finally { clearTimeout(t); }
}

// Старые функции не используем
export async function startAnalyze(){ throw new Error("Not used. Upload → getResult(mediaId)."); }
export async function getStatus(){ throw new Error("Not used. Upload → getResult(mediaId)."); }