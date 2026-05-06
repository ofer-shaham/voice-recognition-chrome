FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cached unless package files change)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

ENV HOST=0.0.0.0
ENV PORT=5000
ENV DANGEROUSLY_DISABLE_HOST_CHECK=true

EXPOSE 5000

CMD ["npm", "start"]
