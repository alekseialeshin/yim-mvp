FROM node:20-bullseye
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=10000 NODE_ENV=production
EXPOSE 10000
CMD ["npm","start"]