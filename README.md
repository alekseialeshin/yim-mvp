Upload/record a short clip → waveform + heatmap → server sends to RD → receive verdict, confidence, inference time, and raw JSON.
	•	Backend (Node/Express). GET /health, POST /analyze, GET /status/:id. Flow: presign → S3 PUT → RD analyze → polling up to 30s. Keys stay server-side. 5xx/timeouts handled. RD_DEMO=1 for offline demo.
	•	RD integration verified. Runs appear in your RD dashboard. HTTP 200, valid request_id and model scores.
	•	Frontend. Upload + mic (≤15s / ≤5MB) with validation. Wavesurfer waveform. Color heatmap (navy→indigo→violet→orange→yellow), dark theme. Clear states: idle/recording/ready/analyzing/done. Fixed “first Analyze hang”. Result card with normalized verdict (AUTHENTIC / MANIPULATED / INCONCLUSIVE), confidence, request_id, inference time, and Raw JSON. Risk strip visualizes confidence and per-model scores.
	•	Run. Codespaces ready. npm run dev or npm start. Health checks working.
