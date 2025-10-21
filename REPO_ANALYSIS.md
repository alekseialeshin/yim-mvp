# YIM MVP Repository Analysis

## Project Overview

**YES IT'S ME (YIM)** is a web-based MVP application for detecting AI-generated/manipulated audio content using the RealityDefender API. The application allows users to upload or record audio clips and analyze them to determine if they are authentic or artificially generated.

## Purpose

The project aims to provide a simple, user-friendly interface for audio deepfake detection. Users can:
- Upload audio files (up to 5MB, under 15 seconds)
- Record audio directly in the browser
- Analyze audio content for authenticity
- View detailed analysis results including confidence scores

## Technology Stack

### Backend
- **Node.js** (v20.19.5) with ES Modules
- **Express.js** (v4.19.2) - Web server framework
- **Multer** (v1.4.5) - File upload handling
- **FFmpeg** (ffmpeg-static v5.2.0) - Audio format conversion
- **dotenv** (v16.4.5) - Environment variable management

### Frontend
- **Vanilla JavaScript** - No framework, pure HTML/CSS/JS
- **WaveSurfer.js** (v7) - Audio waveform visualization and playback
- **Spectrogram Plugin** - Audio frequency visualization

### Python Integration
- **Python 3.12.3** - For RealityDefender API integration
- **realitydefender** - Python SDK for deepfake detection (required but not pre-installed)

## Architecture

### File Structure
```
yim-mvp/
├── server.js           # Express server with API endpoints
├── rd_proxy.py         # Python script for RealityDefender API calls
├── package.json        # Node.js dependencies
├── .env                # Environment variables (not committed)
├── .env.example        # Environment variable template
├── public/
│   ├── index.html      # Main UI page
│   ├── app.js          # Frontend JavaScript logic
│   └── demo.wav        # Demo audio file
└── .devcontainer/      # Development container configuration
```

## Key Components

### 1. Server (server.js)

**Main Routes:**
- `GET /health` - Health check endpoint that returns:
  - Python binary path
  - Demo mode status
  - FFmpeg availability
  
- `POST /analyze` - Main analysis endpoint that:
  1. Accepts audio file uploads (or uses demo file if none provided)
  2. Converts audio to WAV format (16kHz, mono) if needed using FFmpeg
  3. Calls Python script for RealityDefender API analysis
  4. Returns analysis results with verdict (real/fake/inconclusive)

**Key Features:**
- No-cache headers for frontend assets (development-friendly)
- 5MB file size limit
- Automatic audio format conversion (supports various formats → WAV)
- Temporary file management (creates and cleans up temp files)
- 35-second timeout for Python API calls

### 2. RealityDefender Proxy (rd_proxy.py)

**Functionality:**
- Interfaces with RealityDefender API using their Python SDK
- Takes audio file path as input
- Returns structured JSON with:
  - Verdict: "real", "fake", or "inconclusive"
  - Confidence score
  - Request ID for tracking
  - Model information
  - Processing time

**Verdict Mapping:**
- "AUTHENTIC" → "real"
- "MANIPULATED" → "fake"
- Other → "inconclusive"

### 3. Frontend (index.html + app.js)

**UI Features:**
- Audio file upload (drag & drop support)
- Browser-based audio recording (up to 15 seconds)
- Real-time waveform visualization
- Spectrogram display (0-8000 Hz)
- Audio playback controls
- Analysis results display with:
  - Verdict (real/fake/inconclusive)
  - Confidence score
  - Status
  - Request ID
  - Raw JSON data (expandable)
  - Inference time

**User Experience:**
- Dark blue themed interface
- Real-time recording timer
- File size and duration validation
- Click-to-play waveform interaction
- Responsive layout

## Workflow

1. **Audio Input:**
   - User uploads audio file OR records via microphone
   - Frontend validates: size ≤ 5MB, duration ≤ 15s

2. **Visualization:**
   - WaveSurfer.js renders waveform
   - Spectrogram plugin shows frequency analysis
   - User can play/pause audio

3. **Analysis:**
   - Frontend sends audio to `/analyze` endpoint
   - Backend saves to temporary file
   - Backend converts to WAV if needed (FFmpeg)
   - Backend calls Python script with audio file path
   - Python script calls RealityDefender API
   - Results flow back: Python → Backend → Frontend

4. **Results Display:**
   - Verdict shown prominently
   - Confidence score displayed
   - Full API response available in expandable section

## Environment Variables

Required in `.env`:
```bash
RD_API_KEY=          # RealityDefender API key (required)
RD_BASE=             # API base URL (optional)
RD_DEMO=1            # Demo mode flag
PORT=3000            # Server port
PYTHON_BIN=          # Python binary path (optional)
VIRTUAL_ENV=         # Virtual environment path (optional)
```

## Dependencies

### Node.js (package.json)
- express: Web server
- multer: File uploads
- ffmpeg-static: Audio conversion
- dotenv: Environment config
- nodemon (dev): Auto-reload during development

### Python (not in requirements.txt)
- realitydefender: API client (must be installed separately)

## Development

**Start server:**
```bash
npm start          # Production mode
npm run dev        # Development mode with nodemon
```

**Prerequisites:**
1. Node.js 20+ installed
2. Python 3.12+ installed
3. `realitydefender` Python package installed
4. RealityDefender API key configured in `.env`

## Security Considerations

1. **File Upload:** Limited to 5MB, memory storage only
2. **Timeout Protection:** 35s timeout on Python API calls
3. **Temporary Files:** Automatically cleaned up after processing
4. **API Key:** Must be set in environment, not in code
5. **Input Validation:** Duration and size checks prevent abuse

## Current State

**Working Features:**
- ✅ Audio upload and recording
- ✅ Waveform and spectrogram visualization
- ✅ Audio format conversion (FFmpeg)
- ✅ RealityDefender API integration
- ✅ Results display with confidence scores
- ✅ Dark themed UI

**Missing/TODO:**
- ❌ No automated tests
- ❌ No .gitignore file (node_modules committed?)
- ❌ No error logging/monitoring
- ❌ No rate limiting
- ❌ Python requirements.txt missing
- ❌ devcontainer.json appears corrupted (contains package.json content)

## Potential Issues

1. **Python Dependency:** realitydefender package not installed in current environment
2. **No .gitignore:** node_modules might be committed to repo
3. **API Key Security:** .env file exists but should never be committed
4. **No Tests:** No test infrastructure present
5. **devcontainer.json:** File content appears incorrect

## Recent Development

Based on git history:
- Latest commit: "stable analysis flow" with UI improvements
- Implemented dark theme
- Fixed race conditions in audio loading
- Added FFmpeg conversion for WebM support
- Improved error handling and cleanup

## Use Case

This MVP is designed for:
- **Content Verification:** Verify if voice recordings are authentic
- **Security:** Detect deepfake audio in communications
- **Media Validation:** Check if audio content has been manipulated
- **Education:** Demonstrate AI-generated content detection

## API Integration

The application relies on **RealityDefender API** which:
- Analyzes audio files for AI manipulation
- Returns confidence scores
- Supports multiple detection models
- Provides request tracking via request IDs

## Browser Compatibility

Frontend requires:
- Modern browser with MediaRecorder API (for recording)
- getUserMedia API (for microphone access)
- Fetch API support
- ES6+ JavaScript support
