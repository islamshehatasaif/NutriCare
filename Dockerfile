# NutriCare AI — container image
FROM node:20-bookworm-slim

# better-sqlite3 needs a build toolchain for the native addon
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=3000
EXPOSE 3000

# Persist the SQLite database on a named volume
VOLUME ["/app/data"]
ENV NUTRICARE_DB=/app/data/nutricare.db

CMD ["node", "server.js"]
