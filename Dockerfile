FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/. .

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

RUN npm install -g @nestjs/cli

COPY --from=builder /app/dist ./dist
COPY backend/package*.json ./
RUN npm install --only=production

EXPOSE 3000

CMD ["node", "dist/main.js"]