FROM node:20-slim

# Install Git and other needed tools
RUN apt-get update -qq && apt-get install --no-install-recommends -y \
  git build-essential python-is-python3 pkg-config \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
