import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class CourtsService {
  constructor(private prisma: PrismaService) {}

  /**
   * UGC 球场注册并进行 50 米防重校验
   */
  async createCourt(userId: string, dto: {
    name: string;
    address: string;
    lng: number;
    lat: number;
    isIndoor: boolean;
    hasLights: boolean;
    numCourts: number;
    netType: string;
    surfaceType: string;
  }) {
    const { name, address, lng, lat, isIndoor, hasLights, numCourts, netType, surfaceType } = dto;

    // 1. 进行 50 米防重检索
    const nearbyCourts: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, name FROM "Court"
      WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 50)
      LIMIT 1;
    `, lng, lat);

    if (nearbyCourts && nearbyCourts.length > 0) {
      throw new ConflictException(`您附近 50 米内已存在球场: "${nearbyCourts[0].name}"，请勿重复创建。`);
    }

    // 2. 生成 UUID 并执行原始 SQL 插入（因为 location 字段类型 Unsupported）
    const courtId = randomUUID();
    const isVerified = false; // 默认不认证，直接可见

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "Court" ("id", "name", "address", "lng", "lat", "location", "isIndoor", "hasLights", "numCourts", "netType", "surfaceType", "isVerified", "createdById")
      VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8, $9, $10, $11, $12)
    `, courtId, name, address, lng, lat, isIndoor, hasLights, numCourts, netType, surfaceType, isVerified, userId);

    return this.getCourtById(courtId);
  }

  /**
   * 获取附近球场（圆形半径搜索）
   */
  async findNearby(lng: number, lat: number, radiusMeters: number = 5000) {
    const courts: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, name, address, "isIndoor", "hasLights", "numCourts", "netType", "surfaceType", "isVerified", "createdById", "created_at",
             ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat,
             ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance
      FROM "Court"
      WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      ORDER BY distance ASC;
    `, lng, lat, radiusMeters);

    return courts;
  }

  /**
   * 获取视口矩形范围内的球场（Bounding Box 搜索）
   */
  async findInViewport(minLng: number, minLat: number, maxLng: number, maxLat: number) {
    const courts: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, name, address, "isIndoor", "hasLights", "numCourts", "netType", "surfaceType", "isVerified", "createdById", "created_at",
             ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
      FROM "Court"
      WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography;
    `, minLng, minLat, maxLng, maxLat);

    return courts;
  }

  /**
   * 获取指定 ID 的球场详情
   */
  async getCourtById(id: string) {
    const result: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, name, address, "isIndoor", "hasLights", "numCourts", "netType", "surfaceType", "isVerified", "createdById", "created_at",
             ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
      FROM "Court"
      WHERE id = $1
      LIMIT 1;
    `, id);

    if (!result || result.length === 0) {
      throw new NotFoundException('找不到指定球场');
    }

    return result[0];
  }

  /**
   * 玩家在球场打卡签到 (Task 4.1)
   */
  async checkIn(userId: string, courtId: string, dto: { startTime: string; endTime: string }) {
    const { startTime, endTime } = dto;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('无效的时间格式');
    }

    if (end <= start) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    // 校验该球场是否存在
    await this.getCourtById(courtId);

    // 检查是否有重叠的签到
    const overlap = await this.prisma.checkIn.findFirst({
      where: {
        userId,
        courtId,
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });

    if (overlap) {
      throw new BadRequestException('您在当前时间段内已在该球场进行过签到打卡');
    }

    return this.prisma.checkIn.create({
      data: {
        userId,
        courtId,
        startTime: start,
        endTime: end,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            skillLevel: true,
          },
        },
      },
    });
  }

  /**
   * 获取球场的活跃签到打卡记录 (未来或者当前正在活动中的签到)
   */
  async getActiveCheckIns(courtId: string) {
    const now = new Date();
    // 校验该球场是否存在
    await this.getCourtById(courtId);

    return this.prisma.checkIn.findMany({
      where: {
        courtId,
        endTime: { gte: now },
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            skillLevel: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  /**
   * 在球场留言板发帖留言 (Task 4.2)
   */
  async createPost(userId: string, courtId: string, content: string) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('留言内容不能为空');
    }

    if (content.length > 500) {
      throw new BadRequestException('留言内容过长，上限 500 字');
    }

    // 校验该球场是否存在
    await this.getCourtById(courtId);

    return this.prisma.bulletinPost.create({
      data: {
        userId,
        courtId,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * 获取球场的留言记录（最新留言最前）
   */
  async getPosts(courtId: string, skip: number = 0, take: number = 20) {
    // 校验该球场是否存在
    await this.getCourtById(courtId);

    return this.prisma.bulletinPost.findMany({
      where: { courtId },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take,
    });
  }
}
