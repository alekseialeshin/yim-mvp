# YES IT'S ME (YIM) - MVP

A web-based application for detecting AI-generated and manipulated audio content using the RealityDefender API.

## 🎯 What This Project Does

YIM MVP provides a simple, user-friendly interface for audio deepfake detection. Users can:
- 🎤 **Record audio** directly in the browser
- 📁 **Upload audio files** (WAV, MP3, WebM, OGG)
- 📊 **Visualize audio** with waveforms and spectrograms
- 🔍 **Analyze authenticity** using AI-powered detection
- 📈 **View confidence scores** and detailed results

## 🏗️ Architecture

### Technology Stack
- **Frontend:** Vanilla JavaScript, WaveSurfer.js for visualization
- **Backend:** Node.js + Express
- **Audio Processing:** FFmpeg for format conversion
- **AI Detection:** RealityDefender API via Python SDK
- **UI:** Custom dark-themed interface

### How It Works
1. User uploads or records audio
2. Frontend displays waveform and spectrogram
3. Backend converts audio to WAV format (if needed)
4. Python script sends audio to RealityDefender API
5. Results show verdict (real/fake/inconclusive) with confidence score

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- RealityDefender API key

### Installation

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your RD_API_KEY

# Start the server
npm start
```

Open browser to: http://localhost:3000

## 📚 Documentation

Comprehensive documentation is available in the following files:

- **[REPO_ANALYSIS.md](REPO_ANALYSIS.md)** - Complete project overview and understanding
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture and system design
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Detailed setup and deployment instructions
- **[API_REFERENCE.md](API_REFERENCE.md)** - API endpoints and usage examples
- **[ISSUES_AND_RECOMMENDATIONS.md](ISSUES_AND_RECOMMENDATIONS.md)** - Known issues and improvements

## 🎨 Features

- ✅ Browser-based audio recording (up to 15 seconds)
- ✅ File upload support (up to 5MB)
- ✅ Real-time waveform visualization
- ✅ Frequency spectrogram display
- ✅ Audio playback controls
- ✅ AI-powered deepfake detection
- ✅ Confidence scoring
- ✅ Dark-themed modern UI

## 🛠️ Development

```bash
# Start with auto-reload
npm run dev

# Check server health
curl http://localhost:3000/health

# Test analysis with demo file
curl -X POST http://localhost:3000/analyze
```

## 📋 API Endpoints

### GET /health
Health check endpoint
```json
{
  "ok": true,
  "py": "/usr/bin/python3",
  "demo": "1",
  "ffmpeg": true
}
```

### POST /analyze
Analyze audio for AI manipulation
- Accepts multipart/form-data with `file` field
- Returns verdict: "real", "fake", or "inconclusive"
- Includes confidence score (0.0 - 1.0)

See [API_REFERENCE.md](API_REFERENCE.md) for detailed documentation.

## 🔒 Security

- File size limited to 5MB
- 35-second timeout on API calls
- Temporary files automatically cleaned up
- API key stored in environment (never in code)

See [ISSUES_AND_RECOMMENDATIONS.md](ISSUES_AND_RECOMMENDATIONS.md) for security recommendations.

## 🐛 Known Issues

- No automated tests
- No rate limiting (recommended for production)
- No structured logging
- See [ISSUES_AND_RECOMMENDATIONS.md](ISSUES_AND_RECOMMENDATIONS.md) for complete list

## 📝 Environment Variables

Required:
```bash
RD_API_KEY=your_api_key_here
```

Optional:
```bash
PORT=3000
RD_DEMO=1
PYTHON_BIN=/usr/bin/python3
```

## 🤝 Contributing

1. Follow existing code style
2. Test your changes locally
3. Update documentation if needed
4. Submit a pull request

## 📄 License

See LICENSE file for details.

## 🙏 Credits

- **RealityDefender** - AI detection API
- **WaveSurfer.js** - Audio visualization
- **FFmpeg** - Audio processing

## 📞 Support

For issues or questions:
1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for troubleshooting
2. Review [API_REFERENCE.md](API_REFERENCE.md) for API details
3. See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
4. Open an issue on GitHub

---

**Version:** 1.0.0  
**Status:** MVP (Minimum Viable Product)