# Deploy to Render

## Quick Start (Web UI)

### Step 1: Push to GitHub

Ensure your code is pushed:
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### Step 2: Connect to Render

1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub account
4. Select `alekseialeshin/yim-mvp` repository
5. Render will auto-detect `render.yaml`

### Step 3: Set Environment Variable

During blueprint setup, add:

```
AURIGIN_API_KEY = DX3A7cKZ4E7lwR839S5Jg6iNLfvALHvw1NEOjLdn
```

✅ Mark as **Secret**

### Step 4: Deploy

Click **"Apply"** - Render will:
- Build Docker image from `Dockerfile`
- Deploy to Frankfurt region
- Set up health checks on `/health`
- Enable auto-deploy on git push

---

## Result

- **URL**: `https://yim-mvp.onrender.com`
- **Region**: Frankfurt 🇩🇪
- **SSL**: Automatic HTTPS
- **Auto-deploy**: Enabled on `main` branch

---

## Manual Environment Setup (if needed)

If you need to add/update the API key later:

1. Dashboard → Your Service → **Environment**
2. Add variable:
   - Key: `AURIGIN_API_KEY`
   - Value: `DX3A7cKZ4E7lwR839S5Jg6iNLfvALHvw1NEOjLdn`
   - ✅ Mark as **Secret**
3. **Save Changes** → Service restarts automatically

---

## Verify Deployment

```bash
# Check health
curl https://yim-mvp.onrender.com/health

# Expected response:
# {"status":"ok","demo":"false","provider":"aurigin"}
```

---

## Notes

- **Free tier**: May sleep after 15 minutes of inactivity (first request takes ~30s)
- **API key security**: Stored as encrypted secret in Render, NOT in git repository
- **Logs**: Available in Render Dashboard → Logs tab
- **Redeploy**: Push to `main` branch triggers automatic deployment

---

## Troubleshooting

### Build fails
Check Render logs for errors. Verify `Dockerfile` builds locally:
```bash
docker build -t yim-mvp .
```

### Health check fails
Ensure:
- Server listens on `process.env.PORT` (Render sets this automatically)
- `/health` endpoint returns 200 status

### API errors
Verify `AURIGIN_API_KEY` is set correctly in Environment variables.
