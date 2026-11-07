import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(userId: string, data: {
    nickname?: string;
    avatarUrl?: string;
    skillLevel?: number;
    bio?: string;
    email?: string;
    isVerified?: boolean;
  }) {
    if (data.skillLevel !== undefined && data.skillLevel !== null) {
      if (typeof data.skillLevel !== 'number' || isNaN(data.skillLevel) || data.skillLevel < 0 || data.skillLevel > 5) {
        throw new BadRequestException('技能评分必须在 0 到 5 之间');
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('找不到指定用户');
    }

    // Check if email is being updated and if it's already taken by another user
    if (data.email && data.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('此电子邮箱已被其他账号使用');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async getProfile(userId: string) {
    const user: any = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            checkIns: true,
            favorites: true,
            hostedSessions: true,
            playSessions: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('找不到指定用户');
    }

    const { _count, ...rest } = user;

    return {
      ...rest,
      isActive: Boolean(user.phone),
      stats: {
        checkInsCount: _count?.checkIns ?? 0,
        favoriteCourtsCount: _count?.favorites ?? 0,
        hostedSessionsCount: _count?.hostedSessions ?? 0,
        joinedSessionsCount: _count?.playSessions ?? 0,
      },
    };
  }

  async searchUsers(params: {
    keyword?: string;
    skillMin?: number;
    skillMax?: number;
  }) {
    const { keyword, skillMin, skillMax } = params;
    const where: any = {};

    if (keyword) {
      where.OR = [
        { nickname: { contains: keyword, mode: 'insensitive' } },
        { email: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (skillMin !== undefined) {
      where.skillLevel = {
        ...(where.skillLevel || {}),
        gte: skillMin,
      };
    }

    if (skillMax !== undefined) {
      where.skillLevel = {
        ...(where.skillLevel || {}),
        lte: skillMax,
      };
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        skillLevel: true,
        bio: true,
        email: true,
        isVerified: true,
        created_at: true,
      },
      orderBy: [{ skillLevel: 'desc' }, { nickname: 'asc' }],
    });
  }
}
