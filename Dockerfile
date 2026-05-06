FROM node:20-alpine

WORKDIR /app

# Dependencies cached separately from source
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# REACT_APP_API_URL is baked in at build time by CRA.
# Docker Compose passes http://localhost:3001 so the browser reaches the server.
ARG REACT_APP_API_URL=http://localhost:3001
ENV REACT_APP_API_URL=$REACT_APP_API_URL

ENV HOST=0.0.0.0
ENV PORT=5000
ENV DANGEROUSLY_DISABLE_HOST_CHECK=true

EXPOSE 5000

CMD ["npm", "start"]
