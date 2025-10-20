// server.js
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, unlink, stat } from 'node:fs/promises';
import os from 'node:os';
import multer from 'multer';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = express();

// no-cache для фронта
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    (req.path === '/' ||
      req.path.startsWith('/public') ||
      req.path.endsWith('.js') ||
      req.path.endsWith('.css') ||
      req.path.endsWith('.html'))
  ) {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

app.use(express.json());
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    cacheControl: false,
    maxAge: 0,
  })
);

// загрузка до 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// --- helpers ---

function resolvePython() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  if (process.env.VIRTUAL_ENV) return path.join(process.env.VIRTUAL_ENV, 'bin', 'python');
  return 'python3';
}

function detectWithPython(inputPath, timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    const py = resolvePython();
    const script = path.join(__dirname, 'rd_proxy.py');
    const p = spawn(py, [script, '--file', inputPath], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      err ||= `timeout ${timeoutMs}ms`;
      try { p.kill('SIGKILL'); } catch {}
    }, timeoutMs);

    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));

    p.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err || out || `rd_proxy exit ${code}`));
      try {
        const json = JSON.parse(out);
        if (!json?.ok) return reject(new Error(json?.error || 'rd_proxy error'));
        resolve(json);
      } catch (e) {
        reject(new Error(`Bad JSON from rd_proxy: ${e.message}`));
      }
    });
  });
}

const EXT_OK = new Set(['.wav', '.wave']);

// пишет буфер в tmp-файл с указанным расширением
async function writeTmp(buf, ext = '.bin') {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  const p = path.join(os.tmpdir(), `${Date.now()}_${Math.random().toString(36).slice(2)}${safeExt}`);
  await writeFile(p, buf);
  return p;
}

// конвертирует в WAV 16k/mono если нужно, иначе возвращает исходный путь
async function ensureWav(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  if (EXT_OK.has(ext)) return { path: inputPath, created: null };

  if (!ffmpegPath) throw new Error('ffmpeg-static not found');

  const outPath = path.join(
    os.tmpdir(),
    `${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
  );

  await new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputPath,
      '-ac', '1',
      '-ar', '16000',
      '-f', 'wav',
      outPath,
    ];
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(err || `ffmpeg exit ${code}`));
    });
  });

  return { path: outPath, created: outPath };
}

// --- routes ---

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    py: resolvePython(),
    demo: process.env.RD_DEMO ?? '0',
    ffmpeg: !!ffmpegPath,
  });
});

app.post('/analyze', upload.single('file'), async (req, res) => {
  const t0 = Date.now();
  let tmpIn = null;
  let tmpWav = null;

  try {
    let buf;
    let name = 'demo.wav';

    if (req.file?.buffer?.length) {
      buf = req.file.buffer;
      name = req.file.originalname || name;
      console.log(`[ANALYZE] upload name=${name} size=${buf.length}`);
    } else {
      const p = path.join(__dirname, 'public', 'demo.wav');
      buf = await readFile(p);
      const st = await stat(p).catch(() => ({ size: buf.length }));
      console.log(`[ANALYZE] fallback demo.wav size=${st.size}`);
    }

    // сохранить входной буфер как tmp с исходным расширением
    const ext = path.extname(name).toLowerCase() || '.bin';
    tmpIn = await writeTmp(buf, ext);

    // при необходимости сконвертировать в wav
    const { path: wavPath, created } = await ensureWav(tmpIn);
    tmpWav = created; // удалим позже только если создавали
    if (created) console.log(`[FFMPEG] converted -> ${path.basename(wavPath)}`);

    console.log(`[RD_PROXY] start ${path.basename(wavPath)}`);
    const py = await detectWithPython(wavPath);
    console.log(`[RD_PROXY] done id=${py.request_id} verdict=${py.verdict} ms=${py.elapsed_ms}`);

    res.json({
      requestId: py.request_id,
      status: py.status,
      verdict: py.verdict,
      confidence: py.confidence,
      inferenceTimeMs: py.elapsed_ms ?? (Date.now() - t0),
      models: py.models,
      raw: py.raw,
    });
  } catch (e) {
    console.error('[ERROR]', e?.message || e);
    res.status(502).json({ error: String(e.message || e) });
  } finally {
    // очистка
    for (const p of [tmpIn, tmpWav]) {
      if (!p) continue;
      try { await unlink(p); } catch {}
    }
  }
});

app.listen(PORT, () => {
  console.log(`YIM MVP server on http://localhost:${PORT}`);
});