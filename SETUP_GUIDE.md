# YIM MVP Setup Guide

## Quick Start

### Prerequisites
- Node.js 20+ 
- Python 3.12+
- RealityDefender API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/alekseialeshin/yim-mvp.git
   cd yim-mvp
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip install realitydefender
   # or in a virtual environment:
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install realitydefender
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your RealityDefender API key
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open in browser**
   ```
   http://localhost:3000
   ```

## Detailed Setup

### 1. System Requirements

#### Operating System
- Linux (recommended)
- macOS
- Windows with WSL2 (recommended) or native

#### Software
- **Node.js:** v20.19.5 or higher
  ```bash
  node --version
  ```

- **npm:** 10.8.2 or higher
  ```bash
  npm --version
  ```

- **Python:** 3.12.3 or higher
  ```bash
  python3 --version
  ```

- **pip:** Latest version
  ```bash
  pip3 --version
  ```

### 2. RealityDefender API Setup

1. **Get API Key**
   - Visit [RealityDefender](https://realitydefender.xyz)
   - Sign up for an account
   - Generate an API key from your dashboard

2. **Test API Access** (optional)
   ```bash
   export RD_API_KEY="your_api_key_here"
   python3 -c "from realitydefender import RealityDefender; print('✓ SDK installed')"
   ```

### 3. Environment Configuration

The `.env` file should contain:

```bash
# Required: Your RealityDefender API key
RD_API_KEY=your_actual_api_key_here

# Optional: API base URL (default is usually fine)
RD_BASE=https://api.realitydefender.xyz

# Optional: Demo mode (set to 1 for demo, 0 for production)
RD_DEMO=1

# Optional: Server port (default: 3000)
PORT=3000

# Optional: Python binary path (auto-detected if not set)
# PYTHON_BIN=/usr/bin/python3

# Optional: Virtual environment path (auto-detected if active)
# VIRTUAL_ENV=/path/to/your/venv
```

### 4. Verify Installation

Run the health check:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "ok": true,
  "py": "/usr/bin/python3",
  "demo": "1",
  "ffmpeg": true
}
```

### 5. Test with Demo File

The application includes a demo WAV file. To test:

1. Open browser to `http://localhost:3000`
2. Click "Analyze" without uploading a file
3. The system will use the built-in `demo.wav`
4. You should see analysis results

## Development Setup

### Using nodemon for Auto-Reload

```bash
npm run dev
```

This will:
- Start the server with nodemon
- Auto-restart on file changes
- Useful for development

### Development with Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install realitydefender

# Set environment variable (optional)
export VIRTUAL_ENV=$(pwd)/venv

# Start server
npm run dev
```

The server will automatically detect and use the virtual environment Python.

## Troubleshooting

### Issue: "NO_RD_API_KEY" Error

**Symptom:** Analysis fails with "NO_RD_API_KEY" error

**Solution:**
1. Check that `.env` file exists
2. Verify `RD_API_KEY` is set in `.env`
3. Restart the server after updating `.env`

### Issue: "realitydefender not found" Error

**Symptom:** Analysis fails with Python import error

**Solution:**
```bash
pip install realitydefender

# If using virtual environment:
source venv/bin/activate
pip install realitydefender
```

### Issue: "ffmpeg exit" Error

**Symptom:** Audio conversion fails

**Solution:**
- FFmpeg should be included via `ffmpeg-static` package
- Try reinstalling dependencies:
  ```bash
  rm -rf node_modules
  npm install
  ```

### Issue: Port Already in Use

**Symptom:** Server fails to start with "EADDRINUSE" error

**Solution:**
```bash
# Change port in .env
PORT=3001

# Or kill process using port 3000
lsof -ti:3000 | xargs kill -9  # Linux/Mac
```

### Issue: File Upload Fails

**Symptom:** "file too large" or "clip too long" error

**Solution:**
- Maximum file size: 5MB
- Maximum duration: 15 seconds
- Try with a shorter/smaller audio file

### Issue: Python Not Found

**Symptom:** Server error about Python binary

**Solution:**
1. Verify Python is installed:
   ```bash
   which python3
   ```

2. Set explicit path in `.env`:
   ```bash
   PYTHON_BIN=/usr/bin/python3
   ```

## Browser Compatibility

### Supported Browsers
- ✅ Chrome 90+
- ✅ Firefox 90+
- ✅ Safari 14+
- ✅ Edge 90+

### Required Browser Features
- MediaRecorder API (for recording)
- getUserMedia API (for microphone)
- Fetch API
- ES6+ JavaScript
- Web Audio API

### Testing in Browser

1. **Test File Upload:**
   - Click "Load audio file"
   - Select a WAV or MP3 file
   - Verify waveform appears

2. **Test Recording:**
   - Click "● REC"
   - Allow microphone access
   - Speak for a few seconds
   - Click "■ STOP"
   - Verify waveform appears

3. **Test Playback:**
   - Click "▶︎ Play"
   - Audio should play
   - Waveform should show progress

4. **Test Analysis:**
   - Click "Analyze"
   - Wait for results
   - Verify verdict appears

## Production Deployment

### Environment Setup

1. **Use Production Environment**
   ```bash
   export NODE_ENV=production
   RD_DEMO=0
   ```

2. **Use Process Manager**
   ```bash
   # Install PM2
   npm install -g pm2

   # Start application
   pm2 start server.js --name yim-mvp

   # Enable auto-restart on boot
   pm2 startup
   pm2 save
   ```

3. **Set Up Reverse Proxy (nginx)**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           
           # Increase timeout for analysis
           proxy_read_timeout 60s;
       }

       # Increase client body size for uploads
       client_max_body_size 10M;
   }
   ```

4. **Enable HTTPS** (Let's Encrypt)
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Security Hardening

1. **Restrict File Uploads**
   - Already limited to 5MB
   - Consider adding rate limiting

2. **Secure API Keys**
   - Never commit `.env` to git
   - Use secrets management in production
   - Rotate keys regularly

3. **Add Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```

4. **Monitor Temp Directory**
   - Set up monitoring for `/tmp` usage
   - Implement cleanup jobs if needed

### Monitoring

1. **Application Logs**
   ```bash
   pm2 logs yim-mvp
   ```

2. **Resource Usage**
   ```bash
   pm2 monit
   ```

3. **Health Checks**
   ```bash
   curl http://localhost:3000/health
   ```

## Testing Your Setup

### Manual Testing Checklist

- [ ] Server starts without errors
- [ ] Health endpoint returns `ok: true`
- [ ] Frontend loads at `http://localhost:3000`
- [ ] Can upload audio file
- [ ] Waveform and spectrogram display
- [ ] Can record audio (if browser supports)
- [ ] Can play audio
- [ ] Analysis completes successfully
- [ ] Results display correctly
- [ ] Demo file works (when no file uploaded)

### Test with cURL

```bash
# Health check
curl http://localhost:3000/health

# Test analysis with demo file (POST without file)
curl -X POST http://localhost:3000/analyze

# Test with actual file
curl -X POST -F "file=@/path/to/audio.wav" http://localhost:3000/analyze
```

## Common Issues and Solutions

### Python Package Conflicts

If you have conflicts with Python packages:

```bash
# Create fresh virtual environment
python3 -m venv venv-yim
source venv-yim/bin/activate
pip install --upgrade pip
pip install realitydefender
```

### Port Conflicts

If port 3000 is taken:

```bash
# Check what's using the port
lsof -i :3000

# Change port in .env
echo "PORT=3001" >> .env
```

### File Permission Issues

If temp files can't be created:

```bash
# Check temp directory permissions
ls -ld $(node -e "console.log(require('os').tmpdir())")

# Should be writable by your user
```

## Getting Help

If you encounter issues:

1. Check the logs:
   ```bash
   npm start  # Watch console output
   ```

2. Verify environment:
   ```bash
   curl http://localhost:3000/health
   ```

3. Test Python script directly:
   ```bash
   export RD_API_KEY="your_key"
   python3 rd_proxy.py --file public/demo.wav
   ```

4. Check browser console (F12) for frontend errors

## Next Steps

After successful setup:

1. Try different audio files (WAV, MP3, etc.)
2. Test with recorded audio
3. Review analysis results
4. Understand confidence scores
5. Explore the Raw JSON output
6. Consider production deployment

## Development Tips

1. **Hot Reload Frontend:**
   - Server has no-cache headers for development
   - Just refresh browser to see changes

2. **Debug Python Script:**
   ```bash
   export RD_API_KEY="your_key"
   python3 -u rd_proxy.py --file public/demo.wav
   ```

3. **Monitor Temp Files:**
   ```bash
   watch -n 1 'ls -lh /tmp/*.wav 2>/dev/null | wc -l'
   ```

4. **Test Audio Conversion:**
   ```bash
   ffmpeg -i input.mp3 -ac 1 -ar 16000 -f wav output.wav
   ```
