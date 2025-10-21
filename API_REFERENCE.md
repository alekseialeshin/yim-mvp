# YIM MVP API Reference

## Base URL
```
http://localhost:3000
```

## Endpoints

### GET /health

Health check endpoint to verify server status.

**Request:**
```http
GET /health HTTP/1.1
Host: localhost:3000
```

**Response:**
```json
{
  "ok": true,
  "py": "/usr/bin/python3",
  "demo": "1",
  "ffmpeg": true
}
```

**Response Fields:**
- `ok` (boolean): Always true if server is running
- `py` (string): Path to Python binary being used
- `demo` (string): Demo mode flag from env ("0" or "1")
- `ffmpeg` (boolean): Whether FFmpeg is available

**Status Codes:**
- `200 OK`: Server is healthy

---

### POST /analyze

Analyze an audio file for AI-generated content detection.

**Request:**
```http
POST /analyze HTTP/1.1
Host: localhost:3000
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="audio.wav"
Content-Type: audio/wav

[Binary audio data]
------WebKitFormBoundary--
```

**Request Parameters:**
- `file` (optional): Audio file upload (multipart/form-data)
  - Max size: 5MB
  - Recommended duration: < 15 seconds
  - Supported formats: WAV, MP3, WebM, OGG, etc.

**Note:** If no file is provided, the demo file (`public/demo.wav`) will be analyzed.

**Success Response (200 OK):**
```json
{
  "requestId": "audio_1234567890abcdef",
  "status": "MANIPULATED",
  "verdict": "fake",
  "confidence": 0.9234,
  "inferenceTimeMs": 12543,
  "models": [
    {
      "name": "audio_detector_v2",
      "score": 0.9234,
      "verdict": "MANIPULATED"
    }
  ],
  "raw": {
    "request_id": "audio_1234567890abcdef",
    "status": "MANIPULATED",
    "score": 0.9234,
    "models": [...]
  }
}
```

**Response Fields:**
- `requestId` (string): Unique identifier for this analysis request
- `status` (string): Raw status from RealityDefender API
  - `"AUTHENTIC"`: Real audio
  - `"MANIPULATED"`: AI-generated or manipulated
  - Other values possible
- `verdict` (string): User-friendly verdict
  - `"real"`: Authentic audio
  - `"fake"`: AI-generated or manipulated
  - `"inconclusive"`: Unable to determine
- `confidence` (number): Confidence score (0.0 to 1.0)
  - Higher values indicate stronger confidence
- `inferenceTimeMs` (number): Time taken for analysis in milliseconds
- `models` (array): Information about detection models used
- `raw` (object): Complete raw response from RealityDefender API

**Error Response (502 Bad Gateway):**
```json
{
  "error": "Error message describing what went wrong"
}
```

**Error Response Examples:**

1. **Missing API Key:**
```json
{
  "error": "NO_RD_API_KEY"
}
```

2. **Python Timeout:**
```json
{
  "error": "timeout 35000ms"
}
```

3. **Invalid Audio Format:**
```json
{
  "error": "ffmpeg exit 1"
}
```

4. **API Error:**
```json
{
  "error": "APIError: Invalid API key"
}
```

**Status Codes:**
- `200 OK`: Analysis completed successfully
- `502 Bad Gateway`: Analysis failed (see error message)

---

## Frontend Assets

### GET /
Serves the main application HTML page.

### GET /app.js
Serves the frontend JavaScript application.

### GET /demo.wav
Serves the demo audio file.

---

## Request Flow

```
1. Client uploads audio file
   ↓
2. Server receives via Multer (5MB limit)
   ↓
3. Server writes to temp file
   ↓
4. Server converts to WAV if needed (FFmpeg)
   ↓
5. Server spawns Python script with file path
   ↓
6. Python script calls RealityDefender API
   ↓
7. RealityDefender analyzes audio
   ↓
8. Results flow back through Python → Server → Client
   ↓
9. Server cleans up temp files
```

---

## Error Codes

### Server Errors

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| `NO_RD_API_KEY` | API key not configured | Set `RD_API_KEY` in `.env` |
| `timeout 35000ms` | Python script timed out | Try shorter audio file |
| `ffmpeg exit N` | Audio conversion failed | Check audio file format |
| `rd_proxy exit N` | Python script crashed | Check logs for details |
| `Bad JSON from rd_proxy` | Invalid response from Python | Check Python script |

### RealityDefender API Errors

| Error | Meaning |
|-------|---------|
| `APIError: Invalid API key` | API key is incorrect |
| `APIError: Rate limit exceeded` | Too many requests |
| `APIError: File too large` | Audio file exceeds API limits |
| `APIError: Unsupported format` | Audio format not supported |

---

## Rate Limiting

**Current Status:** ❌ Not implemented

**Recommendation:** Implement rate limiting to prevent abuse.

---

## Authentication

**Current Status:** ❌ Not required

The application currently does not require authentication. All endpoints are publicly accessible.

**Security Note:** In production, consider adding:
- API key authentication
- User accounts and quotas
- Rate limiting per user/IP

---

## Examples

### cURL Examples

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Analyze Demo File (no upload):**
```bash
curl -X POST http://localhost:3000/analyze
```

**Analyze Custom File:**
```bash
curl -X POST \
  -F "file=@/path/to/audio.wav" \
  http://localhost:3000/analyze
```

**With JSON Pretty Print:**
```bash
curl -X POST \
  -F "file=@audio.wav" \
  http://localhost:3000/analyze | jq
```

### JavaScript Fetch Examples

**Health Check:**
```javascript
fetch('/health')
  .then(r => r.json())
  .then(data => console.log(data));
```

**Analyze File:**
```javascript
const fileInput = document.getElementById('file');
const file = fileInput.files[0];

const formData = new FormData();
formData.append('file', file, file.name);

fetch('/analyze', {
  method: 'POST',
  body: formData
})
  .then(r => r.json())
  .then(result => {
    console.log('Verdict:', result.verdict);
    console.log('Confidence:', result.confidence);
  })
  .catch(err => console.error('Error:', err));
```

**With Timeout and AbortController:**
```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000);

fetch('/analyze', {
  method: 'POST',
  body: formData,
  signal: controller.signal
})
  .then(r => r.json())
  .then(result => console.log(result))
  .catch(err => {
    if (err.name === 'AbortError') {
      console.error('Request timed out');
    } else {
      console.error('Error:', err);
    }
  })
  .finally(() => clearTimeout(timeout));
```

### Python Example (Direct API Call)

If you want to call the Python script directly:

```bash
export RD_API_KEY="your_api_key"
python3 rd_proxy.py --file audio.wav
```

Output:
```json
{
  "ok": true,
  "request_id": "audio_1234567890",
  "status": "AUTHENTIC",
  "verdict": "real",
  "confidence": 0.95,
  "elapsed_ms": 1234,
  "models": [...],
  "raw": {...}
}
```

---

## Response Time Expectations

| Operation | Typical Time |
|-----------|-------------|
| Health check | < 10ms |
| File upload | 10-500ms (depends on file size) |
| Audio conversion (FFmpeg) | 100-5000ms (depends on file size) |
| RealityDefender API | 2000-30000ms (depends on audio duration) |
| Total analysis | 3000-35000ms |

**Note:** The Python script has a 35-second timeout. If analysis takes longer, it will be killed and return a timeout error.

---

## Limitations

### File Constraints
- **Max file size:** 5MB (enforced by Multer)
- **Recommended duration:** < 15 seconds (enforced by UI)
- **Timeout:** 35 seconds for Python API call

### Supported Audio Formats
- WAV (no conversion needed)
- MP3 (converted via FFmpeg)
- WebM (converted via FFmpeg)
- OGG (converted via FFmpeg)
- Most common audio formats (converted via FFmpeg)

### RealityDefender API Limits
- Depends on your API plan
- Check with RealityDefender for rate limits
- API key required

---

## WebSocket Support

**Current Status:** ❌ Not implemented

Future enhancement could add WebSocket for:
- Real-time analysis progress
- Live audio streaming
- Push notifications

---

## Versioning

**Current Version:** 1.0.0 (from package.json)

**API Version:** Not versioned (future: `/api/v1/...`)

---

## CORS

**Current Status:** Not configured (same-origin only)

**Headers Set:**
- `Cache-Control: no-store` (for development)

**Recommendation:** Configure CORS for cross-origin requests if needed.

---

## Content Types

### Request Content-Type
- `multipart/form-data` (for file uploads)

### Response Content-Type
- `application/json` (all endpoints)

---

## HTTP Methods

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/health` | GET | Health check |
| `/analyze` | POST | Audio analysis |
| `/` | GET | Serve HTML |
| `/app.js` | GET | Serve JavaScript |
| `/demo.wav` | GET | Serve demo file |

---

## Security Headers

**Current Implementation:**
```javascript
// No-cache for development
Cache-Control: no-store
```

**Recommended Additions:**
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (for HTTPS)

---

## Monitoring Endpoints

### Current
- `/health` - Basic health check

### Recommended Future Additions
- `/health/ready` - Readiness check (API key configured, dependencies available)
- `/health/live` - Liveness check (server responsive)
- `/metrics` - Prometheus metrics
- `/stats` - Usage statistics

---

## Development vs Production

### Development Mode
- No-cache headers enabled
- Verbose logging
- Demo mode enabled

### Production Mode
- Cache headers for static assets
- Structured logging
- Demo mode disabled
- Rate limiting enabled
- HTTPS required

---

## Testing the API

### Postman Collection

Create a collection with:

1. **Health Check**
   - Method: GET
   - URL: `{{baseUrl}}/health`

2. **Analyze Demo**
   - Method: POST
   - URL: `{{baseUrl}}/analyze`

3. **Analyze File**
   - Method: POST
   - URL: `{{baseUrl}}/analyze`
   - Body: form-data with `file` key

### Environment Variables
```
baseUrl = http://localhost:3000
```

---

## Future API Enhancements

1. **Batch Processing:**
   ```
   POST /analyze/batch
   ```

2. **Job Status:**
   ```
   GET /analyze/:requestId/status
   ```

3. **History:**
   ```
   GET /analyze/history
   ```

4. **User Management:**
   ```
   POST /auth/login
   POST /auth/register
   GET /user/profile
   ```

5. **Webhooks:**
   ```
   POST /webhooks/configure
   ```
