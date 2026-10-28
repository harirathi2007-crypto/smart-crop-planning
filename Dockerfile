FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY client/package.json client/package-lock.json ./client/
RUN npm --prefix client ci

COPY . .
RUN npm --prefix client run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY models ./models
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "server.js"]
