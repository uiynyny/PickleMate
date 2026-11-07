import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../auth/active-user.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('rooms/court/:courtId')
  @UseGuards(JwtAuthGuard)
  async getOrCreateCourtRoom(
    @Request() req: any,
    @Param('courtId') courtId: string,
  ) {
    return this.chatService.getOrCreateCourtRoom(courtId, req.user?.sub);
  }

  @Post('rooms/session/:sessionId')
  @UseGuards(JwtAuthGuard)
  async getOrCreateSessionRoom(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ) {
    return this.chatService.getOrCreateSessionRoom(sessionId, req.user?.sub);
  }

  @Get('rooms')
  @UseGuards(JwtAuthGuard)
  async getUserRooms(@Request() req: any) {
    return this.chatService.getUserRooms(req.user.sub);
  }

  @Get('rooms/:roomId/messages')
  async getRoomMessages(
    @Param('roomId') roomId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getRoomMessages(
      roomId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 30,
    );
  }

  @Post('rooms/:roomId/messages')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async sendRoomMessage(
    @Request() req: any,
    @Param('roomId') roomId: string,
    @Body()
    body: {
      content: string;
      type?: 'TEXT' | 'IMAGE' | 'POLL';
      parentId?: string;
      pollOptions?: string[];
    },
  ) {
    return this.chatService.sendRoomMessage(req.user.sub, roomId, body);
  }

  @Post('messages/:messageId/vote')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async votePoll(
    @Request() req: any,
    @Param('messageId') messageId: string,
    @Body('optionId') optionId: string,
  ) {
    return this.chatService.votePoll(req.user.sub, messageId, optionId);
  }

  @Post('dm/:targetUserId')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async getOrCreateDm(
    @Request() req: any,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.chatService.getOrCreateDm(req.user.sub, targetUserId);
  }

  @Get('dm')
  @UseGuards(JwtAuthGuard)
  async getUserDms(@Request() req: any) {
    return this.chatService.getUserDms(req.user.sub);
  }

  @Get('dm/:dmId/messages')
  @UseGuards(JwtAuthGuard)
  async getDmMessages(
    @Request() req: any,
    @Param('dmId') dmId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getDmMessages(
      req.user.sub,
      dmId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 30,
    );
  }

  @Post('dm/:dmId/messages')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async sendDmMessage(
    @Request() req: any,
    @Param('dmId') dmId: string,
    @Body()
    body: {
      content: string;
      type?: 'TEXT' | 'IMAGE';
      parentId?: string;
    },
  ) {
    return this.chatService.sendDmMessage(req.user.sub, dmId, body);
  }
}
