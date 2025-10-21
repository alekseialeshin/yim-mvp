# YIM MVP Technical Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Frontend (public/)                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ index.html   │  │   app.js     │  │  demo.wav    │ │ │
│  │  │              │  │              │  │              │ │ │
│  │  │ • UI Layout  │  │ • File Upload│  │ • Fallback   │ │ │
│  │  │ • Styling    │  │ • Recording  │  │   Sample     │ │ │
│  │  │ • WaveSurfer │  │ • Playback   │  │              │ │ │
│  │  │ • Controls   │  │ • Analyze    │  │              │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP
                        │ POST /analyze (multipart/form-data)
                        │ GET /health
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Server                            │
│                     (server.js)                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Express App                                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │   Multer     │  │   Routes     │  │   Helpers    │ │ │
│  │  │              │  │              │  │              │ │ │
│  │  │ • File Upload│  │ GET /health  │  │ resolvePython│ │ │
│  │  │ • 5MB Limit  │  │ POST /analyze│  │ writeTmp     │ │ │
│  │  │ • Memory     │  │              │  │ ensureWav    │ │ │
│  │  │   Storage    │  │              │  │ detectWith   │ │ │
│  │  │              │  │              │  │   Python     │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└───────┬──────────────────────────────────┬──────────────────┘
        │                                  │
        │ spawn()                          │ spawn()
        │ FFmpeg conversion                │ Python script
        ▼                                  ▼
┌──────────────────┐           ┌───────────────────────────┐
│  FFmpeg Static   │           │  Python Script            │
│                  │           │  (rd_proxy.py)            │
│ • Convert to WAV │           │  ┌─────────────────────┐  │
│ • 16kHz          │           │  │ RealityDefender SDK │  │
│ • Mono           │           │  │                     │  │
│ • Temp Files     │           │  │ • API Client        │  │
└──────────────────┘           │  │ • detect_file()     │  │
                               │  │ • JSON Response     │  │
                               │  └─────────────────────┘  │
                               └───────────┬───────────────┘
                                           │ HTTPS
                                           │ POST
                                           ▼
                               ┌───────────────────────────┐
                               │  RealityDefender API      │
                               │  (api.realitydefender.xyz)│
                               │                           │
                               │ • AI Audio Detection      │
                               │ • Multiple Models         │
                               │ • Confidence Scoring      │
                               │ • Request Tracking        │
                               └───────────────────────────┘
```

## Data Flow

### 1. Audio Upload Flow
```
User → Browser File Input → FormData → POST /analyze 
  → Multer (parse multipart) → Buffer in Memory
  → writeTmp(buffer, ext) → /tmp/timestamp_random.{ext}
```

### 2. Audio Recording Flow
```
User Click Record → getUserMedia() → MediaRecorder
  → Chunks Collection → Blob (audio/webm)
  → WaveSurfer.loadBlob() → Display Waveform
  → User Click Analyze → POST /analyze
```

### 3. Audio Conversion Flow
```
Temp File → ensureWav(inputPath)
  ├─ If .wav/.wave → Return same path
  └─ Else → FFmpeg spawn
      ├─ Input: Any audio format
      ├─ Args: -ac 1 -ar 16000 -f wav
      └─ Output: /tmp/timestamp_random.wav
```

### 4. Analysis Flow
```
WAV File → detectWithPython(wavPath, 35000ms)
  → spawn(python3, ['rd_proxy.py', '--file', path])
  → rd_proxy.py reads file
  → RealityDefender.detect_file(path)
  → API Call (HTTPS)
  → JSON Response
  → Parse & Map Verdict
  → stdout → Server parses JSON
  → Send to Browser
```

### 5. Cleanup Flow
```
Analysis Complete/Error
  → Finally block executes
  → unlink(tmpIn) - Original upload
  → unlink(tmpWav) - Converted file (if created)
  → Temp files removed
```

## Component Interactions

### Server → FFmpeg
- **Communication:** Child process spawn
- **Input:** Audio file path, output path
- **Output:** Converted WAV file at output path
- **Error Handling:** stderr capture, exit code check
- **Timeout:** Inherits from Node.js process

### Server → Python Script
- **Communication:** Child process spawn
- **Input:** File path via CLI args
- **Output:** JSON on stdout
- **Error Handling:** stderr capture, 35s timeout, SIGKILL
- **Environment:** Passes through process.env

### Python Script → RealityDefender API
- **Communication:** HTTPS via SDK
- **Authentication:** API key from RD_API_KEY env var
- **Input:** Audio file path
- **Output:** Detection result with confidence
- **Error Handling:** Try/catch, JSON error response

### Browser → Server
- **Communication:** HTTP/HTTPS
- **Endpoints:** 
  - `/health` - GET - Server status
  - `/analyze` - POST - Multipart form with audio file
- **Timeout:** 60s hard timeout in browser
- **Error Handling:** HTTP status codes, JSON error messages

## State Management

### Frontend State
```javascript
let ws;              // WaveSurfer instance
let spec;            // Spectrogram plugin
let mediaRecorder;   // MediaRecorder API
let recChunks;       // Recording data chunks
let currentBlob;     // Current audio blob
let tickTimer;       // Recording timer
let isPlaying;       // Playback state
let currentCtrl;     // AbortController for fetch
```

### Server State
- **Stateless:** Each request is independent
- **Temp Files:** Created and cleaned per request
- **No Session:** No user sessions or persistent state

## Security Architecture

### Input Validation
```
Browser Level:
├─ File size check (< 5MB)
├─ Duration check (< 15s)
└─ File type validation (audio/*)

Server Level:
├─ Multer file size limit (5MB)
├─ File extension validation
└─ Path sanitization for temp files
```

### API Key Protection
```
Environment Variable (RD_API_KEY)
  → Not in code
  → Not in git (.env in .gitignore should be)
  → Passed to Python subprocess
  → Never exposed to browser
```

### Temporary File Security
```
Temp File Creation:
├─ Random filename (Date.now() + Math.random())
├─ System temp directory (os.tmpdir())
└─ Automatic cleanup in finally block

File Access:
├─ Process-local only
├─ No public URL exposure
└─ Cleaned immediately after use
```

## Error Handling

### Frontend Errors
- Network failures → Alert user
- Timeout (60s) → Abort and alert
- Invalid audio → Decode error alert
- Validation failures → User-friendly messages

### Backend Errors
- Upload errors → 400/502 with error message
- FFmpeg failure → stderr captured, 502 response
- Python timeout → SIGKILL, error response
- Python crash → stderr captured, error response
- API failure → Propagated from Python, 502 response

### Python Script Errors
- No API key → Exit 1, JSON error
- API exception → Exit 2, JSON error with details
- All errors → Structured JSON with `ok: false`

## Performance Characteristics

### File Size Limits
- **Upload:** 5MB max (Multer limit)
- **Duration:** 15s recommended (UI validation)
- **Memory:** Entire file in memory during processing

### Timeouts
- **Python API call:** 35 seconds
- **Browser fetch:** 60 seconds hard timeout
- **FFmpeg:** No explicit timeout (usually < 5s)

### Concurrency
- **Server:** Single-threaded Node.js (event loop)
- **Processes:** Spawns child processes for FFmpeg/Python
- **Requests:** Can handle multiple concurrent requests
- **Bottleneck:** RealityDefender API rate limits (unknown)

## Environment Configuration

### Required
```bash
RD_API_KEY=your_api_key_here
```

### Optional
```bash
PORT=3000                        # Server port
RD_BASE=https://api.realitydefender.xyz  # API URL
RD_DEMO=1                        # Demo mode flag
PYTHON_BIN=/path/to/python       # Python binary
VIRTUAL_ENV=/path/to/venv        # Virtual environment
```

### Python Resolution Logic
```
1. Check PYTHON_BIN env var → Use if set
2. Check VIRTUAL_ENV → Use {VIRTUAL_ENV}/bin/python
3. Default → Use 'python3'
```

## Deployment Considerations

### Requirements
1. Node.js 20+ runtime
2. Python 3.12+ with realitydefender package
3. FFmpeg (bundled via ffmpeg-static)
4. RealityDefender API key
5. Writable temp directory

### Environment Setup
```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install realitydefender

# Configure environment
cp .env.example .env
# Edit .env and add RD_API_KEY

# Start server
npm start
```

### Production Recommendations
- Use process manager (PM2, systemd)
- Set up reverse proxy (nginx)
- Enable HTTPS
- Add rate limiting
- Implement logging
- Monitor temp directory cleanup
- Set resource limits
- Add health checks

## Scalability Notes

### Current Limitations
- Single server instance
- In-memory file handling
- Synchronous file processing
- No request queuing
- No load balancing

### Potential Improvements
- Add Redis for job queue
- Stream file processing
- Implement worker pools
- Add load balancer
- Implement caching for demo files
- Add database for request tracking
