// server.js
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import multer from 'multer';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// запуск Python-SDK прокси
async function detectWithPython(tempPath) {
  const script = path.join(__dirname, 'rd_proxy.py');
  return new Promise((resolve, reject) => {
    const p = spawn('python', [script, '--file', tempPath], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('close', code => {
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

// POST /analyze: multipart поле "file"; если нет — берём public/demo.wav
app.post('/analyze', upload.single('file'), async (req, res) => {
  const t0 = Date.now();
  let tmp = null;
  try {
    let buf, name = 'demo.wav';
    if (req.file?.buffer?.length) {
      buf = req.file.buffer;
      name = req.file.originalname || name;
    } else {
      buf = await readFile(path.join(__dirname, 'public', 'demo.wav'));
    }

    const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    tmp = path.join(os.tmpdir(), `${Date.now()}_${safe}`);
    await writeFile(tmp, buf);

    const py = await detectWithPython(tmp);
    return res.json({
      requestId: py.request_id,
      status: py.status,                  // AUTHENTIC | MANIPULATED | INCONCLUSIVE
      verdict: py.verdict,                // real | fake | inconclusive
      confidence: py.confidence,          // RD score
      inferenceTimeMs: py.elapsed_ms ?? (Date.now() - t0),
      models: py.models,
      raw: py.raw,                        // полный ответ SDK
    });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  } finally {
    if (tmp) { try { await unlink(tmp); } catch {} }
  }
});

app.listen(PORT, () => {
  console.log(`YIM MVP server on http://localhost:${PORT}`);
});