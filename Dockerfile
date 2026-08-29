# syntax=docker/dockerfile:1

# ---- deps: install once, reused by both the build and prod-only layers ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript -> dist/ ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- prod deps: node_modules without devDependencies, for a smaller image ----
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: only what's needed to run the compiled app ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runs as an unprivileged user rather than root — standard container
# hardening, and the base node:alpine image ships this user already.
RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER app
EXPOSE 5011

CMD ["node", "dist/main.js"]
