import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;

  const mockPrisma = {
    court: { findUnique: jest.fn() },
    playSession: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    chatRoom: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    dmConversation: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockChatGateway = {
    emitToRoom: jest.fn(),
  };

  const mockNotifications = {
    sendNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChatGateway, useValue: mockChatGateway },
        { provide: NotificationsGateway, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
  });

  it('lazily provisions a court chat room via upsert', async () => {
    mockPrisma.court.findUnique.mockResolvedValue({ id: 'c1', name: 'Chaoyang Park' });
    mockPrisma.chatRoom.upsert.mockResolvedValue({
      id: 'room-c1',
      courtId: 'c1',
      name: 'Chaoyang Park 球场群聊',
    });

    const room = await service.getOrCreateCourtRoom('c1', 'u1');
    expect(room.id).toBe('room-c1');
    expect(mockPrisma.chatRoom.upsert).toHaveBeenCalled();
  });

  it('lazily provisions a play session chat room via upsert', async () => {
    mockPrisma.playSession.findUnique.mockResolvedValue({ id: 's1', title: 'Friday Doubles' });
    mockPrisma.chatRoom.upsert.mockResolvedValue({
      id: 'room-s1',
      sessionId: 's1',
      name: 'Friday Doubles 球局群聊',
    });

    const room = await service.getOrCreateSessionRoom('s1', 'u1');
    expect(room.id).toBe('room-s1');
    expect(mockPrisma.chatRoom.upsert).toHaveBeenCalled();
  });

  it('orders userAId and userBId lexicographically when creating or finding a DM conversation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-a', nickname: 'Alice' });
    mockPrisma.dmConversation.upsert.mockResolvedValue({
      id: 'dm-1',
      userAId: 'user-a',
      userBId: 'user-z',
    });

    await service.getOrCreateDm('user-z', 'user-a');
    expect(mockPrisma.dmConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userAId_userBId: { userAId: 'user-a', userBId: 'user-z' } },
      }),
    );
  });

  it('rejects self-DM and unauthorized DM message reads/writes', async () => {
    await expect(service.getOrCreateDm('u1', 'u1')).rejects.toThrow(BadRequestException);

    mockPrisma.dmConversation.findUnique.mockResolvedValue({
      id: 'dm-1',
      userAId: 'u1',
      userBId: 'u2',
    });
    await expect(service.getDmMessages('intruder', 'dm-1')).rejects.toThrow(ForbiddenException);
    await expect(
      service.sendDmMessage('intruder', 'dm-1', { content: 'hi' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates a POLL message with structured options and broadcasts chat:message', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue({ id: 'r1', name: 'Room 1' });
    mockPrisma.chatRoom.update.mockResolvedValue({ id: 'r1' });
    mockPrisma.chatMessage.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'm-poll',
        ...data,
        user: { id: 'u1', nickname: 'Host' },
      }),
    );

    const msg = await service.sendRoomMessage('u1', 'r1', {
      content: 'When should we play?',
      type: 'POLL',
      pollOptions: ['Saturday 9am', 'Sunday 4pm'],
    });

    expect(msg.parsedPollOptions).toEqual([
      { id: 'opt-0', text: 'Saturday 9am', voterIds: [] },
      { id: 'opt-1', text: 'Sunday 4pm', voterIds: [] },
    ]);
    expect(mockChatGateway.emitToRoom).toHaveBeenCalledWith('r1', 'chat:message', expect.any(Object));
  });

  it('switches user vote across poll options without duplicating voterIds and rejects invalid optionId', async () => {
    const initialPoll = [
      { id: 'opt-1', text: 'Saturday 9am', voterIds: ['u1', 'u2'] },
      { id: 'opt-2', text: 'Sunday 4pm', voterIds: [] },
    ];
    mockPrisma.chatMessage.findUnique.mockResolvedValue({
      id: 'm1',
      type: 'POLL',
      roomId: 'r1',
      pollOptions: JSON.stringify(initialPoll),
    });
    mockPrisma.chatMessage.update.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'm1',
        type: 'POLL',
        roomId: 'r1',
        pollOptions: data.pollOptions,
        user: { id: 'u1', nickname: 'Host' },
      }),
    );

    const updated = await service.votePoll('u1', 'm1', 'opt-2');
    expect(updated.parsedPollOptions).toEqual([
      { id: 'opt-1', text: 'Saturday 9am', voterIds: ['u2'] },
      { id: 'opt-2', text: 'Sunday 4pm', voterIds: ['u1'] },
    ]);
    expect(mockChatGateway.emitToRoom).toHaveBeenCalledWith('r1', 'chat:pollUpdated', expect.any(Object));

    await expect(service.votePoll('u1', 'm1', 'non-existent')).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when voting on a missing message', async () => {
    mockPrisma.chatMessage.findUnique.mockResolvedValue(null);
    await expect(service.votePoll('u1', 'missing', 'opt-1')).rejects.toThrow(NotFoundException);
  });
});
