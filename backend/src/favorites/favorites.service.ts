import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Add a court to user's favorites
   */
  async addFavorite(userId: string, courtId: string) {
    // Check if court exists
    const courtExists = await this.prisma.court.findUnique({
      where: { id: courtId },
    });

    if (!courtExists) {
      throw new NotFoundException('Court not found');
    }

    // Check if already favorited
    const existingFavorite = await this.prisma.favorite.findUnique({
      where: {
        userId_courtId: {
          userId,
          courtId,
        },
      },
    });

    if (existingFavorite) {
      return existingFavorite; // Already favorited
    }

    // Create favorite
    return this.prisma.favorite.create({
      data: {
        userId,
        courtId,
      },
    });
  }

  /**
   * Remove a court from user's favorites
   */
  async removeFavorite(userId: string, courtId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_courtId: {
          userId,
          courtId,
        },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    return this.prisma.favorite.delete({
      where: {
        id: favorite.id,
      },
    });
  }

  /**
   * Get all favorite courts for a user
   */
  async getUserFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        court: {
          select: {
            id: true,
            name: true,
            address: true,
            isIndoor: true,
            hasLights: true,
            numCourts: true,
            netType: true,
            surfaceType: true,
            isVerified: true,
            created_at: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Check if a court is favorited by a user
   */
  async isFavorited(userId: string, courtId: string): Promise<boolean> {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_courtId: {
          userId,
          courtId,
        },
      },
    });

    return !!favorite;
  }
}