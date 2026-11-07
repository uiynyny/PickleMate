import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('chat:join')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ) {
    if (data?.roomId) {
      client.join(data.roomId);
      this.logger.log(`Socket ${client.id} joined room ${data.roomId}`);
      client.to(data.roomId).emit('chat:userJoined', {
        roomId: data.roomId,
        userId: data.userId,
      });
    }
    return { joined: data?.roomId };
  }

  @SubscribeMessage('chat:leave')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ) {
    if (data?.roomId) {
      client.leave(data.roomId);
      client.to(data.roomId).emit('chat:userLeft', {
        roomId: data.roomId,
        userId: data.userId,
      });
    }
    return { left: data?.roomId };
  }

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId?: string; dmId?: string; userId: string; nickname?: string },
  ) {
    const targetRoom = data?.roomId || data?.dmId;
    if (targetRoom) {
      client.to(targetRoom).emit('chat:typing', data);
    }
  }

  emitToRoom(roomId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(roomId).emit(event, payload);
    }
  }
}
