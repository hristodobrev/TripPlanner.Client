FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

FROM nginx:alpine
COPY dist/tripplanner-client/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf