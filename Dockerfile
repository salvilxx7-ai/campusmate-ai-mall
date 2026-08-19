FROM node:22-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

ENV CAMPUSMATE_EMBEDDING_CACHE=/opt/campusmate-fastembed

RUN npm install -g corepack@latest \
    && corepack pnpm install \
    && pip3 install --break-system-packages --no-cache-dir -r python-agent/requirements.txt \
    && python3 python-agent/warm_embedding_model.py \
    && corepack pnpm run build

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
