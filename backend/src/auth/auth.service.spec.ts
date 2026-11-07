import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock_token'),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'WECHAT_APPID') return 'mock_appid';
      if (key === 'WECHAT_SECRET') return 'mock_secret';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should request an OTP successfully', async () => {
    const res = await service.requestOtp('13800138000');
    expect(res.message).toContain('验证码已发送');
    expect(res.code).toHaveLength(4);
  });

  it('should throw BadRequestException for invalid phone format', async () => {
    await expect(service.requestOtp('123')).rejects.toThrow(BadRequestException);
  });

  it('should verify OTP and log in existing user', async () => {
    const phone = '13800138000';
    const reqRes = await service.requestOtp(phone);
    const code = reqRes.code;

    const mockUser = { id: 'u1', phone, nickname: 'Existing User' };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const loginRes = await service.verifyOtpAndLogin(phone, code);
    expect(loginRes.accessToken).toBe('mock_token');
    expect(loginRes.user).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { phone } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should verify OTP and register/create new user if not exists', async () => {
    const phone = '13800138001';
    const reqRes = await service.requestOtp(phone);
    const code = reqRes.code;

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const mockCreatedUser = { id: 'u2', phone, nickname: '球友_1234' };
    (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

    const loginRes = await service.verifyOtpAndLogin(phone, code);
    expect(loginRes.accessToken).toBe('mock_token');
    expect(loginRes.user).toEqual(mockCreatedUser);
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('should throw BadRequestException if code is incorrect', async () => {
    const phone = '13800138000';
    await service.requestOtp(phone);
    await expect(service.verifyOtpAndLogin(phone, '9999')).rejects.toThrow(BadRequestException);
  });

  it('should handle Apple Sign-In successfully (create or find Inactive User)', async () => {
    const appleUserId = 'apple_abc123';
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const mockCreatedUser = { id: 'u3', appleUserId, nickname: 'Apple球友_9999', phone: null };
    (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

    const res = await service.appleLogin(appleUserId);
    expect(res.accessToken).toBe('mock_token');
    expect(res.user.phone).toBeNull();
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('should link phone number (promoting Inactive to Active user)', async () => {
    const userId = 'u3';
    const phone = '13800138999';
    const reqRes = await service.requestOtp(phone);
    const code = reqRes.code;

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // No existing user with this phone
    const mockUpdatedUser = { id: userId, phone, nickname: 'Apple球友_9999' };
    (prisma.user.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

    const res = await service.linkPhone(userId, phone, code);
    expect(res.accessToken).toBe('mock_token');
    expect(res.user.phone).toBe(phone);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { phone },
    });
  });

  it('should throw ConflictException when linking phone already in use', async () => {
    const userId = 'u3';
    const phone = '13800138999';
    const reqRes = await service.requestOtp(phone);
    const code = reqRes.code;

    const existingUser = { id: 'other_user_id', phone };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);

    await expect(service.linkPhone(userId, phone, code)).rejects.toThrow(ConflictException);
  });
});
