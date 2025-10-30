FROM node:20-bookworm

# Install ffmpeg only (Python no longer needed)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Koyeb will inject PORT env variable (default 8000)
ENV NODE_ENV=production

# Expose port (Koyeb ignores EXPOSE but good practice)
EXPOSE 8000

# Health check for container monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

CMD ["npm", "start"]
