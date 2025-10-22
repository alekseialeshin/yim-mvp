# Copilot instructions for this repo (yim-mvp)

This repo is a minimal audio-analysis MVP:
- Node 20 + Express serves static UI and a single inference endpoint.
- A Python helper (`rd_proxy.py`) shells out from Node to Reality Defender’s API.
- Client UI (vanilla JS + WaveSurfer) handles recording/upload, validation, waveform, and a risk heatmap.

## Architecture and data flow
- Entry points
  - Server: `server.js` (ESM). Starts Express on `PORT` (default 3000).
  - Frontend: `public/index.html`, logic in `public/app.js`, assets served from `/public`.
  - Python bridge: `rd_proxy.py` (invoked via `child_process.spawn`).
- Request flow (POST /analyze)
  1) UI validates clip (≤5MB, ≤15s) then `fetch('/analyze', FormData{file})`.
  2) Server accepts multipart with Multer (in-memory), writes a tmp file with the original extension.
  3) If not `.wav/.wave`, converts to WAV 16kHz mono using `ffmpeg-static`.
  4) Spawns Python (see `resolvePython()`), runs `rd_proxy.py --file <wav>` with a 35s timeout.
  5) Python calls Reality Defender `detect_file`, returns JSON; Node maps to camelCase and responds.
  6) UI shows verdict, confidence, per-model votes, and draws a color risk strip.
- Other endpoints: `GET /health` for quick diagnostics (python bin, ffmpeg presence, demo flag).

## Integration details (Reality Defender)
- Python uses `from realitydefender import RealityDefender`; install the pip package (likely `reality-defender`).
- Required env: `RD_API_KEY`. If missing, Python prints JSON `{ok:false, error:"NO_RD_API_KEY"}` and exits non‑zero (Node surfaces as 502).
- Verdict mapping in `rd_proxy.py`: AUTHENTIC→`real`, MANIPULATED→`fake`, else `inconclusive`.

## Local dev workflow
- Scripts: `npm run dev` (nodemon), `npm start` (node server.js). ESM only (`"type":"module"`).
- Env:
  - `RD_API_KEY=<your key>` (required for real calls).
  - Optional: `PYTHON_BIN` to force a Python interpreter; else uses `$VIRTUAL_ENV/bin/python` or `python3`.
  - `PORT` (default 3000). `GET /health` confirms config.
- Docker: `dockerfile` expects a `requirements.txt` for Python deps, then runs `npm start` on `PORT=10000`.
  - Note: repo currently lacks `requirements.txt`—add `reality-defender` there to build images.

## Server conventions and guardrails
- File uploads: field name is `file`; Multer limit is 5 MB memory upload. On absence, falls back to `public/demo.wav`.
- Transcoding: only converts when not `.wav/.wave`; output WAV is 16kHz mono.
- Timeouts: Python subprocess ~35s; the UI hard-aborts fetch at 60s.
- Errors: server responds 502 with `{error}` on failures; temp files are cleaned in `finally`.
- Response shape (example):
  ```json
  {
    "requestId": "...",
    "status": "AUTHENTIC|MANIPULATED|...",
    "verdict": "real|fake|inconclusive",
    "confidence": 0.0-1.0,
    "inferenceTimeMs": 1234,
    "models": [ {"name": "...", "score": 0.73}, ... ],
    "raw": { /* RD response passthrough */ }
  }
  ```

## Frontend specifics
- Uses WaveSurfer 7.7.13 via CDN; renders waveform and a custom risk heatmap (navy→indigo→violet→orange→yellow).
- Validation enforced client-side: size ≤ 5MB, duration ≤ 15s; keep these in sync with server Multer limit.
- UI integrates model votes and a summary card; risk strip blends local spectral metrics with server `confidence`.

## Examples
- cURL upload:
  ```bash
  curl -F "file=@public/demo.wav" http://localhost:3000/analyze
  ```
- Minimal .env for dev:
  ```env
  RD_API_KEY=sk_live_or_test
  PORT=3000
  # PYTHON_BIN=/usr/bin/python3
  ```

## Tips for AI agents making changes
- Keep route contract stable (`POST /analyze` expects `file`). If you change limits or fields, update both `server.js` and `public/app.js`.
- When touching Python, ensure imports are available at module import time (top-level import will crash early if missing).
- If adjusting audio formats, also revisit `EXT_OK`, ffmpeg args, and UI validation text in `public/index.html`.
- Document any new env vars in `README.md` and mirrored in `/health` where useful.
