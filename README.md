![LTO github readme](https://user-images.githubusercontent.com/100821/196711741-96cd4ba5-932a-4e95-b420-42d4d61c21fd.png)

# Relay

[![Build Status](https://app.travis-ci.com/ltonetwork/relay.svg?token=uXSzwRjzLQ9smewqbtDx&branch=master)](https://app.travis-ci.com/ltonetwork/relay)

Communication service for the LTO Network private layer. Relays encrypted messages between accounts.


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

## Client usage

```typescript
import LTO from '@ltonetwork/lto';
import { Relay, Message } from '@ltonetwork/lto/messages';

const lto = new LTO('T');
lto.relay = new Relay('http://localhost:3000'); // Connect to your local relay service

const account = lto.account({ seed: "My seed phrase" });

const message = new Message('hello')
  .to('3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM')
  .signWith(account);

await lto.anchor(account, message.hash);
await lto.relay.send(message);
```

[See documentation](https://docs.ltonetwork.com/libraries/javascript/messages) for more information.

