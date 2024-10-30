import { MessageService } from './message.service';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const WS_PORT = parseInt(process.env.WS_PORT, 10) || 8080;

@WebSocketGateway(WS_PORT, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/messages',
})
export class MessageGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly messageService: MessageService) {}

  @SubscribeMessage('checkNewMessageCount')
  async handleCheckNewMessageCount(
    @MessageBody() data: { address: string; knownHashes: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const { address, knownHashes } = data;
    const serverHashes = await this.messageService.getMessageHashes(address);
    const newHashes = serverHashes.filter((hash) => !knownHashes.includes(hash));
    const count = newHashes.length;

    // Emit new message count and hashes to the client
    client.emit('newMessageCount', { count, newHashes });
  }
}
