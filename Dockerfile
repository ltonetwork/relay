FROM node:20 AS build

WORKDIR /usr/src

COPY package.json yarn.lock ./

RUN yarn

COPY . .

RUN yarn version --new-version $(git describe --tags) --no-git-tag-version

RUN yarn build

FROM node:20-alpine
WORKDIR /usr/app

RUN yarn global add pm2

COPY package.json yarn.lock ./
RUN yarn --production

COPY --from=build /usr/src/dist ./

EXPOSE 3000
CMD ["pm2-runtime", "main.js"]