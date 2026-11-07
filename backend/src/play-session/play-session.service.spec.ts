import { Test, TestingModule } from '@nestjs/testing';
import { PlaySessionService } from './play-session.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PlaySessionService', () => {
  let service: PlaySessionService;

  const mockPrisma = {
    court: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    playSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    sessionInvite: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockNotifications = {
    sendNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaySessionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsGateway, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<PlaySessionService>(PlaySessionService);
    jest.clearAllMocks();
  });

  it('marks pending invites older than 24h as EXPIRED and rejects respondToInvite', async () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    mockPrisma.sessionInvite.findUnique.mockResolvedValue({
      id: 'inv-1',
      recipientId: 'u2',
      status: 'PENDING',
      sentAt: staleDate,
      sessionId: 's1',
      session: {
        id: 's1',
        hostId: 'host-1',
        playTime: new Date(Date.now() + 3600000),
        maxPlayers: 4,
        skillMin: 2.5,
        skillMax: 4.0,
      },
    });
    mockPrisma.sessionInvite.update.mockResolvedValue({ id: 'inv-1', status: 'EXPIRED' });

    await expect(service.respondToInvite('u2', 'inv-1', 'ACCEPTED')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'EXPIRED' },
    });
  });

  it('marks pending invites for past sessions as EXPIRED when responding', async () => {
    const recentSent = new Date(Date.now() - 1000 * 60 * 10);
    mockPrisma.sessionInvite.findUnique.mockResolvedValue({
      id: 'inv-2',
      recipientId: 'u2',
      status: 'PENDING',
      sentAt: recentSent,
      sessionId: 's1',
      session: {
        id: 's1',
        hostId: 'host-1',
        playTime: new Date(Date.now() - 3600000), // in the past
        maxPlayers: 4,
        skillMin: 2.5,
        skillMax: 4.0,
      },
    });
    mockPrisma.sessionInvite.update.mockResolvedValue({ id: 'inv-2', status: 'EXPIRED' });

    await expect(service.respondToInvite('u2', 'inv-2', 'ACCEPTED')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
      where: { id: 'inv-2' },
      data: { status: 'EXPIRED' },
    });
  });

  it('expires stale invites before returning getUserInvites', async () => {
    mockPrisma.sessionInvite.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sessionInvite.findMany.mockResolvedValue([]);

    await service.getUserInvites('u2');
    expect(mockPrisma.sessionInvite.updateMany).toHaveBeenCalled();
  });

  it('returns skill-matched active users excluding host, joined players, and pending invitees', async () => {
    mockPrisma.playSession.findUnique.mockResolvedValue({
      id: 's1',
      hostId: 'host-1',
      skillMin: 3.0,
      skillMax: 4.0,
      players: [{ id: 'joined-1' }],
      invites: [{ recipientId: 'invited-1', status: 'PENDING' }],
    });
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'candidate-2', nickname: 'Rookie', avatarUrl: null, skillLevel: null, bio: null },
      { id: 'candidate-1', nickname: 'DinkMaster', avatarUrl: null, skillLevel: 3.5, bio: null },
    ]);

    const recs = await (service as any).getRecommendations('s1', 'Dink');
    expect(recs).toHaveLength(2);
    expect(recs[0].id).toBe('candidate-1'); // skill-matched ranked first
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ['host-1', 'joined-1', 'invited-1'] },
          phone: { not: null },
        }),
      }),
    );
  });

  it('throws NotFoundException in getRecommendations if session does not exist', async () => {
    mockPrisma.playSession.findUnique.mockResolvedValue(null);
    await expect((service as any).getRecommendations('missing')).rejects.toThrow(NotFoundException);
  });
});
