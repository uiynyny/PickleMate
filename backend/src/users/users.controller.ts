import { Controller, Get, Patch, Body, UseGuards, Request, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    const userId = req.user.sub;
    return this.usersService.getProfile(userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req: any, @Body() body: {
    nickname?: string;
    avatarUrl?: string;
    skillLevel?: number;
    bio?: string;
    email?: string;
  }) {
    const userId = req.user.sub;
    return this.usersService.updateProfile(userId, body);
  }

  @Get('search')
  async searchUsers(
    @Query('keyword') keyword?: string,
    @Query('skillMin') skillMin?: string,
    @Query('skillMax') skillMax?: string,
  ) {
    return this.usersService.searchUsers({
      keyword,
      skillMin: skillMin !== undefined ? parseFloat(skillMin) : undefined,
      skillMax: skillMax !== undefined ? parseFloat(skillMax) : undefined,
    });
  }
}
