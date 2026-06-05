FROM node:22-alpine

WORKDIR /app

COPY worker/package*.json ./
RUN npm ci

COPY worker ./

RUN npx tsc

CMD ["node", "dist/index.js"]
