import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { NotificationsGateway } from '../notifications/notifications.gateway';

export interface PollOptionItem {
  id: string;
  text: string;
  voterIds: string[];
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
    private notificationsGateway: NotificationsGateway,
  ) {}

  private formatMessage(msg: any) {
    if (!msg) return msg;
    let parsedPollOptions: PollOptionItem[] | null = null;
    if (msg.pollOptions) {
      try {
        parsedPollOptions = JSON.parse(msg.pollOptions);
      } catch {
        parsedPollOptions = null;
      }
    }
    return {
      ...msg,
      parsedPollOptions,
    };
  }

  /**
   * Lazily get or create a Court group chat room
   */
  async getOrCreateCourtRoom(courtId: string, userId?: string) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
    });
    if (!court) {
      throw new NotFoundException('找不到指定球场');
    }

    const participantConnect = userId
      ? { connect: { id: userId } }
      : undefined;

    return this.prisma.chatRoom.upsert({
      where: { courtId },
      create: {
        courtId,
        name: `${court.name} 球场群聊`,
        ...(participantConnect ? { participants: participantConnect } : {}),
      },
      update: participantConnect ? { participants: participantConnect } : {},
      include: {
        court: {
          select: { id: true, name: true, address: true },
        },
      },
    });
  }

  /**
   * Lazily get or create a PlaySession group chat room
   */
  async getOrCreateSessionRoom(sessionId: string, userId?: string) {
    const session = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('找不到指定球局');
    }

    const participantConnect = userId
      ? { connect: { id: userId } }
      : undefined;

    return this.prisma.chatRoom.upsert({
      where: { sessionId },
      create: {
        sessionId,
        name: `${session.title} 球局群聊`,
        ...(participantConnect ? { participants: participantConnect } : {}),
      },
      update: participantConnect ? { participants: participantConnect } : {},
      include: {
        session: {
          select: { id: true, title: true, playTime: true, courtId: true },
        },
      },
    });
  }

  /**
   * List all group chat rooms the user participates in (or hosts/joined via PlaySession)
   */
  async getUserRooms(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        OR: [
          { participants: { some: { id: userId } } },
          { session: { hostId: userId } },
          { session: { players: { some: { id: userId } } } },
        ],
      },
      include: {
        court: { select: { id: true, name: true, address: true } },
        session: { select: { id: true, title: true, playTime: true } },
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        _count: {
          select: { participants: true, messages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rooms.map((room: any) => ({
      ...room,
      lastMessage: room.messages?.[0] ? this.formatMessage(room.messages[0]) : null,
      messages: undefined,
    }));
  }

  /**
   * Get paginated messages in a group chat room
   */
  async getRoomMessages(roomId: string, page: number = 1, limit: number = 30) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        court: { select: { id: true, name: true } },
        session: { select: { id: true, title: true } },
      },
    });
    if (!room) {
      throw new NotFoundException('找不到指定聊天室');
    }

    const skip = (page - 1) * limit;
    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId, isDeleted: false },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true, skillLevel: true },
        },
        parent: {
          select: {
            id: true,
            content: true,
            type: true,
            user: { select: { id: true, nickname: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });

    return {
      room,
      messages: messages.map((m) => this.formatMessage(m)),
    };
  }

  /**
   * Send a message (TEXT, IMAGE, or POLL) to a group chat room
   */
  async sendRoomMessage(
    userId: string,
    roomId: string,
    dto: {
      content: string;
      type?: 'TEXT' | 'IMAGE' | 'POLL';
      parentId?: string;
      pollOptions?: string[];
    },
  ) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new NotFoundException('找不到指定聊天室');
    }

    const type = dto.type || 'TEXT';
    if (!dto.content || !dto.content.trim()) {
      throw new BadRequestException('消息内容不能为空');
    }

    let serializedPoll: string | undefined = undefined;
    if (type === 'POLL') {
      const validOptions = (dto.pollOptions || [])
        .map((o) => o?.trim())
        .filter((o): o is string => Boolean(o));
      if (validOptions.length < 2) {
        throw new BadRequestException('投票至少需要 2 个有效选项');
      }
      const pollItems: PollOptionItem[] = validOptions.map((text, idx) => ({
        id: `opt-${idx}`,
        text,
        voterIds: [],
      }));
      serializedPoll = JSON.stringify(pollItems);
    }

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        participants: { connect: { id: userId } },
      },
    });

    const created = await this.prisma.chatMessage.create({
      data: {
        roomId,
        userId,
        content: dto.content.trim(),
        type,
        parentId: dto.parentId || undefined,
        pollOptions: serializedPoll,
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true, skillLevel: true },
        },
        parent: {
          select: {
            id: true,
            content: true,
            type: true,
            user: { select: { id: true, nickname: true } },
          },
        },
      },
    });

    const formatted = this.formatMessage(created);
    this.chatGateway.emitToRoom(roomId, 'chat:message', formatted);
    return formatted;
  }

  /**
   * Vote on a POLL message
   */
  async votePoll(userId: string, messageId: string, optionId: string) {
    const msg = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg) {
      throw new NotFoundException('找不到指定投票消息');
    }
    if (msg.type !== 'POLL' || !msg.pollOptions) {
      throw new BadRequestException('该消息不是投票类型');
    }

    let options: PollOptionItem[] = [];
    try {
      options = JSON.parse(msg.pollOptions);
    } catch {
      throw new BadRequestException('投票数据格式损坏');
    }

    const targetOption = options.find((o) => o.id === optionId);
    if (!targetOption) {
      throw new BadRequestException('无效的投票选项');
    }

    const alreadyVotedOnTarget = targetOption.voterIds.includes(userId);
    const updatedOptions = options.map((opt) => {
      const filtered = opt.voterIds.filter((id) => id !== userId);
      if (opt.id === optionId && !alreadyVotedOnTarget) {
        filtered.push(userId);
      }
      return {
        ...opt,
        voterIds: filtered,
      };
    });

    const updated = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        pollOptions: JSON.stringify(updatedOptions),
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true, skillLevel: true },
        },
      },
    });

    const formatted = this.formatMessage(updated);
    if (updated.roomId) {
      this.chatGateway.emitToRoom(updated.roomId, 'chat:pollUpdated', formatted);
    }
    return formatted;
  }

  /**
   * Get or create a 1-on-1 DM conversation with canonical lexicographical ordering
   */
  async getOrCreateDm(userId: string, targetUserId: string) {
    if (!targetUserId || userId === targetUserId) {
      throw new BadRequestException('不能与自己发起私信会话');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('找不到目标用户');
    }

    const [userAId, userBId] = [userId, targetUserId].sort();

    return this.prisma.dmConversation.upsert({
      where: {
        userAId_userBId: { userAId, userBId },
      },
      create: {
        userAId,
        userBId,
      },
      update: {},
      include: {
        userA: { select: { id: true, nickname: true, avatarUrl: true, skillLevel: true } },
        userB: { select: { id: true, nickname: true, avatarUrl: true, skillLevel: true } },
      },
    });
  }

  /**
   * List all 1-on-1 DM conversations for a user
   */
  async getUserDms(userId: string) {
    const dms = await this.prisma.dmConversation.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: { id: true, nickname: true, avatarUrl: true, skillLevel: true } },
        userB: { select: { id: true, nickname: true, avatarUrl: true, skillLevel: true } },
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return dms.map((dm: any) => {
      const partner = dm.userAId === userId ? dm.userB : dm.userA;
      return {
        id: dm.id,
        partner,
        lastMessage: dm.messages?.[0] ? this.formatMessage(dm.messages[0]) : null,
        updatedAt: dm.updatedAt,
        createdAt: dm.createdAt,
      };
    });
  }

  /**
   * Get messages in a 1-on-1 DM conversation
   */
  async getDmMessages(userId: string, dmId: string, page: number = 1, limit: number = 30) {
    const dm: any = await this.prisma.dmConversation.findUnique({
      where: { id: dmId },
      include: {
        userA: { select: { id: true, nickname: true, avatarUrl: true, skillLevel: true } },
        userB: { select: { id: true, nickname: true, avatarUrl: true, skillLevel: true } },
      },
    });
    if (!dm) {
      throw new NotFoundException('找不到指定私信会话');
    }
    if (dm.userAId !== userId && dm.userBId !== userId) {
      throw new ForbiddenException('无权访问此私信会话');
    }

    const skip = (page - 1) * limit;
    const messages = await this.prisma.chatMessage.findMany({
      where: { dmId, isDeleted: false },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true, skillLevel: true },
        },
        parent: {
          select: {
            id: true,
            content: true,
            type: true,
            user: { select: { id: true, nickname: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });

    const partner = dm.userAId === userId ? dm.userB : dm.userA;
    return {
      dm: {
        id: dm.id,
        partner,
      },
      messages: messages.map((m) => this.formatMessage(m)),
    };
  }

  /**
   * Send a message in a 1-on-1 DM conversation
   */
  async sendDmMessage(
    userId: string,
    dmId: string,
    dto: {
      content: string;
      type?: 'TEXT' | 'IMAGE';
      parentId?: string;
    },
  ) {
    const dm = await this.prisma.dmConversation.findUnique({
      where: { id: dmId },
    });
    if (!dm) {
      throw new NotFoundException('找不到指定私信会话');
    }
    if (dm.userAId !== userId && dm.userBId !== userId) {
      throw new ForbiddenException('无权在此私信会话中发言');
    }
    if (!dto.content || !dto.content.trim()) {
      throw new BadRequestException('消息内容不能为空');
    }

    const created = await this.prisma.chatMessage.create({
      data: {
        dmId,
        userId,
        content: dto.content.trim(),
        type: dto.type || 'TEXT',
        parentId: dto.parentId || undefined,
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true, skillLevel: true },
        },
        parent: {
          select: {
            id: true,
            content: true,
            type: true,
            user: { select: { id: true, nickname: true } },
          },
        },
      },
    });

    await this.prisma.dmConversation.update({
      where: { id: dmId },
      data: { updatedAt: new Date() },
    });

    const formatted = this.formatMessage(created);
    const recipientId = dm.userAId === userId ? dm.userBId : dm.userAId;
    this.notificationsGateway.sendNotification(recipientId, 'dm:message', formatted);
    this.chatGateway.emitToRoom(dmId, 'dm:message', formatted);
    return formatted;
  }
}
