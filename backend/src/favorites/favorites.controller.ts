import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../auth/active-user.guard';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':courtId')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async addToFavorites(
    @Request() req: any,
    @Param('courtId') courtId: string,
  ) {
    const userId = req.user.sub;
    return this.favoritesService.addFavorite(userId, courtId);
  }

  @Delete(':courtId')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async removeFromFavorites(
    @Request() req: any,
    @Param('courtId') courtId: string,
  ) {
    const userId = req.user.sub;
    return this.favoritesService.removeFavorite(userId, courtId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async getUserFavorites(@Request() req: any) {
    const userId = req.user.sub;
    return this.favoritesService.getUserFavorites(userId);
  }

  @Get(':courtId/check')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async isFavorited(
    @Request() req: any,
    @Param('courtId') courtId: string,
  ) {
    const userId = req.user.sub;
    const isFavorited = await this.favoritesService.isFavorited(
      userId,
      courtId,
    );
    return { isFavorited };
  }
}