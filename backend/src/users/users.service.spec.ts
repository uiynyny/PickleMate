import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('returns profile with aggregated stats and isActive=true when phone is set', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: 'Ace',
      phone: '13800138000',
      skillLevel: 3.5,
      _count: {
        checkIns: 4,
        favorites: 2,
        hostedSessions: 3,
        playSessions: 5,
      },
    });

    const profile: any = await service.getProfile('u1');
    expect(profile.isActive).toBe(true);
    expect(profile.stats).toEqual({
      checkInsCount: 4,
      favoriteCourtsCount: 2,
      hostedSessionsCount: 3,
      joinedSessionsCount: 5,
    });
  });

  it('returns isActive=false when user phone is null (Inactive User)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      nickname: 'AppleUser',
      phone: null,
      skillLevel: null,
      _count: {
        checkIns: 0,
        favorites: 0,
        hostedSessions: 0,
        playSessions: 0,
      },
    });

    const profile: any = await service.getProfile('u2');
    expect(profile.isActive).toBe(false);
    expect(profile.stats.checkInsCount).toBe(0);
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
  });

  it('rejects skillLevel outside [0, 5] in updateProfile', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: null });
    await expect(service.updateProfile('u1', { skillLevel: 6.0 })).rejects.toThrow(BadRequestException);
    await expect(service.updateProfile('u1', { skillLevel: -0.5 })).rejects.toThrow(BadRequestException);
  });

  it('updates profile when skillLevel and email are valid', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'u1', email: 'old@test.com' })
      .mockResolvedValueOnce(null);
    mockPrisma.user.update.mockResolvedValue({
      id: 'u1',
      nickname: 'TopSpin',
      skillLevel: 4.0,
      email: 'new@test.com',
    });

    const res = await service.updateProfile('u1', {
      nickname: 'TopSpin',
      skillLevel: 4.0,
      email: 'new@test.com',
    });
    expect(res.nickname).toBe('TopSpin');
    expect(res.skillLevel).toBe(4.0);
  });

  it('throws ConflictException when updating email to one already taken', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'u1', email: 'old@test.com' })
      .mockResolvedValueOnce({ id: 'u2', email: 'taken@test.com' });

    await expect(service.updateProfile('u1', { email: 'taken@test.com' })).rejects.toThrow(ConflictException);
  });
});
