import { Test, TestingModule } from '@nestjs/testing';
import { MessageGateway } from './message.gateway';
import { MessageService } from './message.service';
import { Server, Socket } from 'socket.io';

describe('MessageGateway', () => {
  let gateway: MessageGateway;
  let messageService: jest.Mocked<MessageService>;
  let server: jest.Mocked<Server>;
  let client: jest.Mocked<Socket>;

  beforeEach(async () => {
    messageService = {
      getMessageHashes: jest.fn(),
    } as any;

    server = {
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageGateway,
        { provide: MessageService, useValue: messageService },
        { provide: Server, useValue: server },
      ],
    }).compile();

    gateway = module.get<MessageGateway>(MessageGateway);

    client = {
      emit: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCheckNewMessageCount', () => {
    it('should emit new message count and hashes', async () => {
      const address = 'recipient1';
      const knownHashes = ['hash1'];
      const serverHashes = ['hash1', 'hash2', 'hash3'];
      messageService.getMessageHashes.mockResolvedValue(serverHashes);

      await gateway.handleCheckNewMessageCount({ address, knownHashes }, client);

      const expectedNewHashes = ['hash2', 'hash3'];
      const expectedCount = expectedNewHashes.length;

      expect(client.emit).toHaveBeenCalledWith('newMessageCount', {
        count: expectedCount,
        newHashes: expectedNewHashes,
      });
      expect(messageService.getMessageHashes).toHaveBeenCalledWith(address);
    });

    it('should emit all server hashes if knownHashes is empty', async () => {
      const address = 'recipient1';
      const knownHashes: string[] = [];
      const serverHashes = ['hash1', 'hash2', 'hash3'];
      messageService.getMessageHashes.mockResolvedValue(serverHashes);

      await gateway.handleCheckNewMessageCount({ address, knownHashes }, client);

      const expectedNewHashes = serverHashes;
      const expectedCount = serverHashes.length;

      expect(client.emit).toHaveBeenCalledWith('newMessageCount', {
        count: expectedCount,
        newHashes: expectedNewHashes,
      });
      expect(messageService.getMessageHashes).toHaveBeenCalledWith(address);
    });
  });
});
