FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p storage/uploads/images storage/uploads/documents

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE ${PORT}

CMD ["sh", "-c", "npx sequelize-cli db:migrate && npm run start"]
