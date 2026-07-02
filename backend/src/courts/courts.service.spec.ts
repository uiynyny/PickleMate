import { Test, TestingModule } from '@nestjs/testing';
import { CourtsService } from './courts.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('CourtsService', () => {
  let service: CourtsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    checkIn: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    bulletinPost: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourtsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CourtsService>(CourtsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createCourt', () => {
    const dto = {
      name: '测试球场',
      address: '北京市朝阳区朝阳公园',
      lng: 116.48,
      lat: 39.95,
      isIndoor: true,
      hasLights: true,
      numCourts: 6,
      netType: 'permanent',
      surfaceType: 'acrylic',
    };

    it('should throw ConflictException if a court exists within 50 meters', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ id: 'c1', name: '既存球场' }]);

      await expect(service.createCourt('u1', dto)).rejects.toThrow(ConflictException);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should successfully create a court and return detail if none is within 50 meters', async () => {
      // 第一次进行 50 米防重检查返回空，第二次查询详情返回具体球场
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          id: 'mock-court-id',
          name: dto.name,
          address: dto.address,
          lng: dto.lng,
          lat: dto.lat,
          isIndoor: dto.isIndoor,
          hasLights: dto.hasLights,
          numCourts: dto.numCourts,
          netType: dto.netType,
          surfaceType: dto.surfaceType,
          isVerified: false,
          createdById: 'u1',
        }]);

      (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      const res = await service.createCourt('u1', dto);
      expect(res.id).toBe('mock-court-id');
      expect(res.name).toBe(dto.name);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('findNearby', () => {
    it('should query nearby courts with distance', async () => {
      const mockNearby = [
        { id: 'c1', name: '朝阳公园球场', distance: 150 },
        { id: 'c2', name: '红领巾公园球场', distance: 1200 },
      ];
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockNearby);

      const res = await service.findNearby(116.48, 39.95, 3000);
      expect(res).toEqual(mockNearby);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('findInViewport', () => {
    it('should query courts inside bounding box', async () => {
      const mockInViewport = [
        { id: 'c1', name: '朝阳公园球场', lng: 116.48, lat: 39.95 },
      ];
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockInViewport);

      const res = await service.findInViewport(116.45, 39.90, 116.50, 40.00);
      expect(res).toEqual(mockInViewport);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('getCourtById', () => {
    it('should throw NotFoundException if court does not exist', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      await expect(service.getCourtById('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should return court details if it exists', async () => {
      const mockCourt = { id: 'c1', name: '朝阳公园球场', lng: 116.48, lat: 39.95 };
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([mockCourt]);

      const res = await service.getCourtById('c1');
      expect(res).toEqual(mockCourt);
    });
  });

  describe('checkIn', () => {
    it('should throw BadRequestException if times are invalid or start >= end', async () => {
      await expect(service.checkIn('u1', 'c1', { startTime: 'invalid', endTime: 'invalid' })).rejects.toThrow(BadRequestException);
      await expect(service.checkIn('u1', 'c1', { startTime: '2026-07-02T10:00:00Z', endTime: '2026-07-02T09:00:00Z' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if overlapping check-in already exists', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ id: 'c1', name: '北京公园' }]);
      (prisma.checkIn.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-checkin' });

      await expect(service.checkIn('u1', 'c1', { startTime: '2026-07-02T10:00:00Z', endTime: '2026-07-02T12:00:00Z' })).rejects.toThrow(BadRequestException);
    });

    it('should create check-in if there is no overlap', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ id: 'c1', name: '北京公园' }]);
      (prisma.checkIn.findFirst as jest.Mock).mockResolvedValue(null);
      const mockResult = { id: 'new-checkin', userId: 'u1', courtId: 'c1' };
      (prisma.checkIn.create as jest.Mock).mockResolvedValue(mockResult);

      const res = await service.checkIn('u1', 'c1', { startTime: '2026-07-02T10:00:00Z', endTime: '2026-07-02T12:00:00Z' });
      expect(res).toEqual(mockResult);
      expect(prisma.checkIn.create).toHaveBeenCalled();
    });
  });

  describe('getActiveCheckIns', () => {
    it('should return list of future check-ins', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ id: 'c1', name: '北京公园' }]);
      const mockList = [{ id: 'chk1', startTime: new Date(), endTime: new Date(Date.now() + 3600000) }];
      (prisma.checkIn.findMany as jest.Mock).mockResolvedValue(mockList);

      const res = await service.getActiveCheckIns('c1');
      expect(res).toEqual(mockList);
    });
  });

  describe('createPost', () => {
    it('should throw BadRequestException if content is empty or exceeds 500 chars', async () => {
      await expect(service.createPost('u1', 'c1', '')).rejects.toThrow(BadRequestException);
      await expect(service.createPost('u1', 'c1', 'a'.repeat(501))).rejects.toThrow(BadRequestException);
    });

    it('should create post successfully', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ id: 'c1', name: '北京公园' }]);
      const mockPost = { id: 'p1', content: '测试留言' };
      (prisma.bulletinPost.create as jest.Mock).mockResolvedValue(mockPost);

      const res = await service.createPost('u1', 'c1', '测试留言');
      expect(res).toEqual(mockPost);
    });
  });

  describe('getPosts', () => {
    it('should return bulletin posts with pagination', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ id: 'c1', name: '北京公园' }]);
      const mockPosts = [{ id: 'p1', content: '1' }, { id: 'p2', content: '2' }];
      (prisma.bulletinPost.findMany as jest.Mock).mockResolvedValue(mockPosts);

      const res = await service.getPosts('c1', 0, 10);
      expect(res).toEqual(mockPosts);
    });
  });
});
