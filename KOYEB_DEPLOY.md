# Деплой на Koyeb

## 🚀 Быстрый старт (Web UI)

### Шаг 1: Создать приложение

1. Перейди на: https://app.koyeb.com/apps
2. Нажми **"Create App"**
3. Выбери **"Deploy from GitHub"**
4. Авторизуй Koyeb для доступа к репозиторию
5. Выбери репозиторий `yim-mvp`

### Шаг 2: Настройки деплоя

**Basic settings:**
- **Name:** `yim-mvp` (или любое имя)
- **Branch:** `main`
- **Builder:** Dockerfile (автоопределится)

**Regions:**
- Выбери: **Frankfurt (fra)** 🇩🇪

**Instance type:**
- Выбери: **Free (Nano)** - 512MB RAM

**Port:**
- Koyeb автоматически определит порт 8000 из Dockerfile

### Шаг 3: Environment Variables

Добавь переменные окружения:

```
AURIGIN_API_KEY = rZQNvzT5ot8kalmnqhBai5z7y81i010e5HJgPB48
NODE_ENV = production
DEMO_MODE = false
```

⚠️ **Важно:** Для `AURIGIN_API_KEY` включи опцию **"Secret"** (галочку)

### Шаг 4: Health Check

Koyeb автоматически настроит health check на основе `HEALTHCHECK` в Dockerfile:
- Path: `/health`
- Port: `8000`

### Шаг 5: Deploy!

Нажми **"Deploy"** ✅

---

## 📦 Результат

После успешного деплоя получишь:

- **URL приложения:** `https://yim-mvp-<org-name>.koyeb.app`
- **Health endpoint:** `https://yim-mvp-<org-name>.koyeb.app/health`
- **Auto SSL:** HTTPS из коробки 🔒
- **Zero downtime:** автодеплой при git push

---

## 🔧 CLI Deployment (альтернатива)

### Установка CLI

```bash
curl -fsSL https://www.koyeb.com/install.sh | sh
```

### Логин

```bash
koyeb login
```

### Создание и деплой

```bash
# Создать app
koyeb app create yim-mvp

# Задеплоить сервис
koyeb service create yim-mvp-web \
  --app yim-mvp \
  --git github.com/alekseialeshin/yim-mvp \
  --git-branch main \
  --git-builder dockerfile \
  --region fra \
  --instance-type free \
  --port 8000:http \
  --route /:8000 \
  --health-check-path /health \
  --env AURIGIN_API_KEY=<your-key> \
  --env NODE_ENV=production \
  --env DEMO_MODE=false
```

---

## ✅ Проверка после деплоя

```bash
# Health check
curl https://yim-mvp-<org>.koyeb.app/health

# Ожидаемый ответ:
# {"status":"ok","demo":"false","provider":"aurigin"}

# Открыть UI в браузере
open https://yim-mvp-<org>.koyeb.app/
```

---

## 🔄 Автоматический деплой

После первого деплоя Koyeb будет автоматически деплоить при каждом push в `main`:

```bash
git add .
git commit -m "Update feature"
git push origin main
# Koyeb автоматически начнет новый деплой
```

---

## 📊 Мониторинг

В Koyeb dashboard доступно:
- Логи в реальном времени
- Метрики использования CPU/RAM
- История деплоев
- Health check статус

---

## ⚡ Преимущества Koyeb Free Tier

✅ **Без холодных стартов** - приложение всегда активно  
✅ **Frankfurt datacenter** - данные в Германии 🇩🇪  
✅ **Automatic HTTPS** - SSL сертификат бесплатно  
✅ **Zero downtime deploys** - без даунтайма при обновлении  
✅ **512MB RAM** - достаточно для Node.js MVP  
✅ **Unlimited bandwidth** - без лимитов на трафик

---

## 🆘 Troubleshooting

### Проблема: Build failed

**Решение:** Проверь, что `Dockerfile` корректный:
```bash
docker build -t yim-mvp .
docker run -p 3000:8000 -e AURIGIN_API_KEY=test yim-mvp
```

### Проблема: Health check fails

**Решение:** Убедись что:
1. `server.js` слушает на `process.env.PORT`
2. Endpoint `/health` отвечает со статусом 200
3. В Dockerfile `EXPOSE 8000`

### Проблема: Application crashes

**Решение:** Проверь логи в Koyeb dashboard:
- App → Services → Logs
- Ищи ошибки Node.js или missing env vars

---

## 📝 Полезные команды

```bash
# Список приложений
koyeb app list

# Логи сервиса
koyeb service logs yim-mvp-web -a yim-mvp

# Статус деплоя
koyeb service get yim-mvp-web -a yim-mvp

# Обновить env var
koyeb service update yim-mvp-web -a yim-mvp \
  --env DEMO_MODE=true

# Рестарт сервиса
koyeb service redeploy yim-mvp-web -a yim-mvp
```

---

## 🌐 Кастомный домен (опционально)

Можно добавить свой домен:
1. Koyeb dashboard → App → Domains
2. Add domain → введи домен
3. Настрой DNS записи (CNAME или A)
4. Koyeb автоматически выдаст SSL сертификат

---

**Готово!** Твой MVP теперь всегда онлайн в Германии 🇩🇪🚀
