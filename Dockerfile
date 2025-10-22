FROM node:20-bookworm
# Install system packages and Python build dependencies required to build some pip packages
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		 python3 python3-pip ffmpeg \
		 build-essential gcc python3-dev libssl-dev libffi-dev pkg-config \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY requirements.txt ./
RUN python3 -m pip install --upgrade pip setuptools wheel \
	&& pip3 install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=10000 NODE_ENV=production
EXPOSE 10000
CMD ["npm","start"]
