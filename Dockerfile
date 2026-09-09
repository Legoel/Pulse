FROM cgr.dev/chainguard/node:latest-dev AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM cgr.dev/chainguard/node:latest

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["dist-server/server/index.js"]