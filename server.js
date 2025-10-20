// server.js
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { getPresigned, uploadToSignedUrl, getResult } from './api/realitydefender.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const RD_DEMO = process.env.RD_DEMO === '1';
const RD_BASE = (process.env.RD_BASE || 'https://api.prd.realitydefender.xyz').trim();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    const name = `demo-${Date.now()}.wav`;
    const p = await getPresigned(name, { retries: 3, baseDelayMs: 600 });
    res.json({ ok: true, id: p.mediaId || p.requestId || null, urlHead: p.signedUrl.slice(0, 80), name });
  } catch (e) {
    res.status(502).json({ ok: false, err: String(e.message || e) });
  }
});

app.post('/analyze', async (_req, res) => {
  const started = Date.now();

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

  try {
    const filePath = path.join(__dirname, 'public', 'demo.wav');
    const buf = await readFile(filePath);

    const fileName = `demo-${Date.now()}.wav`;
    const p = await getPresigned(fileName, { retries: 12, baseDelayMs: 800 });

    await uploadToSignedUrl(p.signedUrl, buf, 'audio/wav');

    const id = p.mediaId || p.requestId;
    if (!id) throw new Error('No mediaId from presign');

    const POLL_MS = 3000;
    const TIMEOUT_MS = 180000;
    const deadline = Date.now() + TIMEOUT_MS;

    let last = null;
    let status = 'ANALYZING';

    while (Date.now() < deadline) {
      last = await getResult(id).catch(() => null);
      status = last?.resultsSummary?.status || status;
      if (status && status !== 'ANALYZING') break;
      await new Promise(r => setTimeout(r, POLL_MS));
    }

    const rs = last?.resultsSummary || {};
    const confidence = rs?.metadata?.finalScore ?? rs?.metadata?.confidence ?? null;
    const verdict =
      rs?.verdict ||
      rs?.label ||
      (confidence == null ? 'inconclusive' : (confidence > 0.5 ? 'fake' : 'real'));

    res.json({
      requestId: id,
      status: status || 'unknown',
      verdict,
      confidence,
      inferenceTimeMs: Date.now() - started,
      raw: rs,
    });
  } catch (e) {
    res.status(503).json({ error: 'RD_UNAVAILABLE', detail: String(e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`YIM MVP server on http://localhost:${PORT}`);
});