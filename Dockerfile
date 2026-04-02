FROM node:20-bookworm AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build:css

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    dumb-init \
    iputils-ping \
    ca-certificates \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/config ./config
COPY --from=build /app/public ./public
COPY --from=build /app/routes ./routes
COPY --from=build /app/views ./views
COPY --from=build /app/index.js ./index.js
COPY --from=build /app/default_import.csv ./default_import.csv
COPY --from=build /app/template.csv ./template.csv

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=80
ENV DB_PATH=/app/data/database.sqlite

RUN mkdir -p /app/data && chown -R node:node /app

VOLUME ["/app/data"]

EXPOSE 80

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
