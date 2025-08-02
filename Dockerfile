# Use Node.js base image
FROM node:20-slim

# Install required build tools and git
RUN apt-get update -qq && apt-get install --no-install-recommends -y \
    git \
    build-essential \
    python-is-python3 \
    pkg-config \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the port your app listens on
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
