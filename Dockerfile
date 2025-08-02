FROM node:20-slim

# Install dependencies
RUN apt-get update -qq && apt-get install --no-install-recommends -y \
  git build-essential python-is-python3 pkg-config \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Force Git to use HTTPS instead of SSH
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
