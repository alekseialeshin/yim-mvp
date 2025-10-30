# YES IT'S ME - Audio Deepfake Detection MVP

Upload/record a short clip → waveform + heatmap → server analyzes via Aurigin API → receive verdict, confidence, inference time, and model votes.

## Architecture

- **Backend**: Node.js + Express
  - `GET /health` - health check (demo mode, provider info)
  - `POST /analyze` - audio analysis endpoint
  - Aurigin API integration via axios
  - FFmpeg transcoding (16kHz mono WAV)
  - 5MB upload limit, handles timeouts/errors
  
- **Frontend**: Vanilla JS + WaveSurfer.js
  - Upload + microphone recording (≤15s / ≤5MB)
  - Waveform visualization
  - Color-coded risk heatmap (navy→indigo→violet→orange→yellow)
  - Result card: verdict (AUTHENTIC/MANIPULATED/INCONCLUSIVE), confidence, model votes
  - Dark theme UI

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
export AURIGIN_API_KEY=your_key_here
export PORT=3000

# Run development server
npm run dev

# Or production
npm start
```

Access at: http://localhost:3000

## Deployment

### Deploy to Koyeb (Free, Germany 🇩🇪)

See detailed guide: [KOYEB_DEPLOY.md](./KOYEB_DEPLOY.md)

**Quick steps:**
1. Push to GitHub
2. Go to [koyeb.com](https://app.koyeb.com)
3. Create App → Deploy from GitHub
4. Select `yim-mvp` repo, Frankfurt region
5. Add `AURIGIN_API_KEY` env variable
6. Deploy! ✅

**Result:** Always-on, no cold starts, free tier in Germany datacenter.

## Environment Variables

```bash
AURIGIN_API_KEY=<required>  # API key for Aurigin detection service
PORT=3000                    # Server port (default: 3000)
NODE_ENV=production          # Environment mode
DEMO_MODE=false              # Use demo responses (for testing)
```

## API Integration (Aurigin)

- **Endpoint**: `POST https://aurigin.ai/api-ext/predict`
- **Auth**: `x-api-key` header
- **Format**: multipart/form-data with audio file
- **Response**: predictions array, global_probability, per-model scores
- **Timeout**: ~35s server-side, 60s client-side

## Tech Stack

- Node.js 20 + Express
- FFmpeg for audio transcoding
- Multer for file uploads
- Axios for HTTP requests
- WaveSurfer.js for audio visualization
- Docker support

## License

MIT

