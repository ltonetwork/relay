# Relay

Communication service for the EQTY private layer. Relays encrypted messages between accounts.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Development

While developing and testing you can choose to run specific services on docker while you make updates to the main relay app.

```
docker compose up redis rabbitmq
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov

# test all
$ npm run test:all
```
