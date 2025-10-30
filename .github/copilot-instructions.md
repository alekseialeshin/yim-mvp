# Copilot instructions for this repo (yim-mvp)

This repo is a minimal audio-analysis MVP:
- Node 20 + Express serves static UI and a single inference endpoint.
- Aurigin API integration via axios for deepfake audio detection.
- Client UI (vanilla JS + WaveSurfer) handles recording/upload, validation, waveform, and a risk heatmap.

## Architecture and data flow
- Entry points
  - Server: `server.js` (ESM). Starts Express on `PORT` (default 3000).
  - Frontend: `public/index.html`, logic in `public/app.js`, assets served from `/public`.
  - Aurigin API: HTTP POST to `https://aurigin.ai/api-ext/predict` via axios.
- Request flow (POST /analyze)
  1) UI validates clip (≤5MB, ≤15s) then `fetch('/analyze', FormData{file})`.
  2) Server accepts multipart with Multer (in-memory), writes a tmp file with the original extension.
  3) If not `.wav/.wave`, converts to WAV 16kHz mono using `ffmpeg-static`.
  4) Calls `detectWithAurigin(wav)` which uses axios + form-data to POST file to Aurigin API with 35s timeout.
  5) Aurigin returns JSON with `predictions` array and `global_probability`; Node maps to camelCase and responds.
  6) UI shows verdict, confidence, per-model votes, and draws a color risk strip.
- Other endpoints: `GET /health` for quick diagnostics (demo flag, provider), `/healthz` for extended info.

## Integration details (Aurigin)
- HTTP API via axios: `POST https://aurigin.ai/api-ext/predict` with multipart/form-data.
- Auth: `x-api-key` header with `AURIGIN_API_KEY` from env.
- Request: FormData with `file` field containing audio stream.
- Response format:
  ```json
  {
    "predictions": ["real", "real"],
    "global_probability": [0.0000010170346, 0.0000010299793],
    "error": [null, null]
  }
  ```
- Mapping: `predictions[0]` → verdict (real/fake), `1 - global_probability[0]` → confidence for real audio.
- If missing `AURIGIN_API_KEY`, server responds 502 with error message.
- Inference time: typically ~4-5 seconds.

## Local dev workflow
- Scripts: `npm run dev` (nodemon), `npm start` (node server.js). ESM only (`"type":"module"`).
- Env:
  - `AURIGIN_API_KEY=<your key>` (required for real calls).
  - `PORT` (default 3000). `GET /health` confirms config.
  - Optional: `DEMO_MODE=true` for simulated responses without API calls.
- Docker: `dockerfile` expects a `requirements.txt` for Python deps (legacy, can be removed), then runs `npm start` on `PORT=10000`.

## Server conventions and guardrails
- File uploads: field name is `file`; Multer limit is 5 MB memory upload. On absence, falls back to `public/demo.wav`.
- Transcoding: only converts when not `.wav/.wave`; output WAV is 16kHz mono.
- Timeouts: Aurigin API timeout ~35s; the UI hard-aborts fetch at 60s.
- Errors: server responds 502 with `{error}` on failures; temp files are cleaned in `finally`.
- Response shape (example):
  ```json
  {
    "requestId": "...",
    "status": "AUTHENTIC|MANIPULATED|INCONCLUSIVE",
    "verdict": "real|fake|inconclusive",
    "confidence": 0.0-1.0,
    "inferenceTimeMs": 1234,
    "models": [ {"name": "...", "score": 0.73}, ... ],
    "raw": { /* Aurigin response passthrough */ }
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
  AURIGIN_API_KEY=rZQNvzT5ot8kalmnqhBai5z7y81i010e5HJgPB48
  PORT=3000
  DEMO_MODE=false
  ```

## Tips for AI agents making changes
- Keep route contract stable (`POST /analyze` expects `file`). If you change limits or fields, update both `server.js` and `public/app.js`.
- If adjusting audio formats, also revisit `EXT_OK`, ffmpeg args, and UI validation text in `public/index.html`.
- Document any new env vars in `README.md` and mirrored in `/health` where useful.
