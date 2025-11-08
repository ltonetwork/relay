FROM node:20 AS build

WORKDIR /usr/src

COPY package.json yarn.lock ./

RUN yarn

COPY . .

# Only run version update if git is available (skip in Docker build)
RUN git describe --tags > /dev/null 2>&1 && yarn version --new-version $(git describe --tags) --no-git-tag-version || echo "Skipping version update"

RUN yarn build

FROM node:20-alpin
WORKDIR /usr/app

RUN yarn config set registry https://registry.npmjs.org
RUN yarn global add pm2

COPY package.json yarn.lock ./
RUN yarn --production

COPY --from=build /usr/src/dist ./
COPY --from=build /usr/src/src/config ./config

# Create storage directories
RUN mkdir -p /storage /thumbnail

EXPOSE 8000
CMD ["node", "main.js"]
