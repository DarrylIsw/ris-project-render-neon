FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    LIBREOFFICE_PATH=/usr/bin/soffice \
    PORT=10000

RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice-writer fontconfig fonts-dejavu-core fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate && npm run build
RUN npm prune --omit=dev --ignore-scripts

EXPOSE 10000
CMD ["node", "internals/scripts/start-render.js"]
