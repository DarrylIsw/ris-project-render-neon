FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    LIBREOFFICE_PATH=/usr/bin/soffice \
    PORT=10000

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libreoffice-writer \
       fontconfig \
       fonts-dejavu-core \
       fonts-liberation \
       openssl \
       ca-certificates \
    && update-ca-certificates \
    && printf '\nprecedence ::ffff:0:0/96  100\n' >> /etc/gai.conf \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY internals/scripts/npmcheckversion.js internals/scripts/dependencies.js ./internals/scripts/
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate && npm run build
RUN npm prune --omit=dev --ignore-scripts

EXPOSE 10000
CMD ["node", "internals/scripts/start-render.js"]
