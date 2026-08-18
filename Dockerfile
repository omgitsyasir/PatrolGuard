# ---- Stage 1: build the React frontend ----
FROM node:24-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- Stage 2: runtime (Express API + static frontend) ----
FROM node:24-bookworm-slim AS server
WORKDIR /app/server
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

COPY server/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server/ ./

WORKDIR /app
COPY --from=client /app/client/dist ./client/dist

RUN mkdir -p /app/data/uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]