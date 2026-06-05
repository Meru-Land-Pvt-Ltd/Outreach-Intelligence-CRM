FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend ./

RUN npx tsc

EXPOSE 5000

CMD ["node", "dist/server.js"]
