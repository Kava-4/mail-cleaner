FROM node:22-alpine AS base
WORKDIR /app

COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
ENV DATA_DIR=/app/data
CMD ["npm", "run", "start"]
