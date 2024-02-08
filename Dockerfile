FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

RUN yarn

RUN yarn add pm2 -g

# Bundle app source
COPY . .

RUN yarn build

EXPOSE 80
CMD ["pm2-runtime", "dist/main.js"]
