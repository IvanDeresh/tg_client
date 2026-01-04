FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache bash git python3 make g++

COPY package*.json ./

RUN npm install --production

COPY . .

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["npx", "npm run dev:client"]
