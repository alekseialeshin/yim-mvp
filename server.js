// server.js
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import multer from 'multer';
import { spawn } from 'node:child_process';

// Оставляем REST-клиент на месте для бэкап-задач/диагностики
import { getPresigned, uploadToSignedUrl, getResult } from './api/realitydefender.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const RD_DEMO = process.env.RD_DEMO === '1';
const RD_BASE = (process.env.RD_BASE || 'https://api.prd.realitydefender.xyz').trim();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// multipart до 5 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// helpers
function summarize(rs) {
  const status = rs?.status || rs?.state || 'unknown';
  const confidence = rs?.metadata?.finalScore ?? rs?.metadata?.confidence ?? null;
  const verdict =
    rs?.verdict ||
    rs?.label ||
    (confidence == null ? 'inconclusive' : (confidence > 0.5 ? 'fake' : 'real'));
  return { status, verdict, confidence, raw: rs };
}

// run Python SDK
async function detectWithPython(tempPath) {
  const script = path.join(__dirname, 'rd_proxy.py');
  return new Promise((resolve, reject) => {
    const p = spawn('python3', [script, '--file', tempPath], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || out || `rd_proxy exit ${code}`));
      try {
        const json = JSON.parse(out);
        if (!json?.ok) return reject(new Error(json?.error || 'rd_proxy error'));
        resolve(json);
      } catch (e) {
        reject(new Error(`Bad JSON from rd_proxy: ${e.message}; out=${out}`));
      }
    });
  });
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/debug/rd', (_req, res) => {
  const k = process.env.RD_API_KEY || '';
  res.json({
    hasKey: Boolean(k),
    len: k.length,
    head: k.slice(0, 6),
    tail: k.slice(-6),
    base: RD_BASE,
    demo: RD_DEMO,
  });
});

app.get('/debug/presign', async (_req, res) => {
  if (RD_DEMO) return res.json({ ok: true, demo: true });
  try {
    const name = `probe-${Date.now()}.wav`;
    const p = await getPresigned(name, { retries: 3, baseDelayMs: 600 });
    res.json({ ok: true, id: p.mediaId || p.requestId || null, urlHead: p.signedUrl.slice(0, 80), name });
  } catch (e) {
    res.status(502).json({ ok: false, err: String(e.message || e) });
  }
});

// 1) Анализ: multipart file или public/demo.wav
app.post('/analyze', upload.single('file'), async (req, res) => {
  const started = Date.now();

  // DEMO
  if (RD_DEMO) {
    return res.json({
      requestId: 'demo-local',
      status: 'done',
      verdict: 'inconclusive',
      confidence: null,
      inferenceTimeMs: Date.now() - started,
      raw: { source: 'demo' },
    });
  }

  // === PRODUCTION PATH via Python SDK ===
  let tmp = null;
  try {
    let buf;
    let clientName = 'demo.wav';
    if (req.file?.buffer?.length) {
      buf = req.file.buffer;
      clientName = req.file.originalname || clientName;
    } else {
      buf = await readFile(path.join(__dirname, 'public', 'demo.wav'));
    }

    const safe = (clientName || 'audio.wav').replace(/[^a-zA-Z0-9._-]/g, '_');
    tmp = path.join(os.tmpdir(), `${Date.now()}_${safe}`);
    await writeFile(tmp, buf);

    const py = await detectWithPython(tmp);
    // py: { ok, request_id, status, verdict, confidence, elapsed_ms, models, raw }
    return res.json({
      requestId: py.request_id,
      status: py.status,
      verdict: py.verdict,
      confidence: py.confidence,
      inferenceTimeMs: py.elapsed_ms ?? (Date.now() - started),
      raw: { models: py.models, rdStatus: py.status, sdk: py.raw },
    });
  } catch (e) {
    return res.status(503).json({ error: 'RD_UNAVAILABLE', detail: String(e.message || e) });
  } finally {
    if (tmp) { try { await unlink(tmp); } catch { /* noop */ } }
  }
});

// 2) Статус (для SDK-пути используем мок, т.к. SDK уже вернул финал)
app.get('/status/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'requestId required' });

  if (RD_DEMO) {
    return res.json({
      requestId: id,
      status: 'done',
      verdict: 'inconclusive',
      confidence: null,
      raw: { source: 'demo' },
    });
  }

  // REST-прокси оставим на случай, если понадобится
  try {
    const r = await getResult(id);
    const s = summarize(r?.resultsSummary || {});
    res.json({ requestId: id, status: s.status, verdict: s.verdict, confidence: s.confidence, raw: s.raw });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`YIM MVP server on http://localhost:${PORT}`);
});