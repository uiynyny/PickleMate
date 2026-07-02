import { Controller, Get, Post, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../auth/active-user.guard';

@Controller('courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, ActiveUserGuard) // 必须是已登录并且激活手机号的用户才能 UGC 创建球场 (ADR-0001)
  async createCourt(@Request() req: any, @Body() body: {
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
    const userId = req.user.sub;
    return this.courtsService.createCourt(userId, body);
  }

  @Get('nearby')
  async findNearby(
    @Query('lng') lng: string,
    @Query('lat') lat: string,
    @Query('radius') radius?: string,
  ) {
    const r = radius ? parseFloat(radius) : 5000;
    return this.courtsService.findNearby(parseFloat(lng), parseFloat(lat), r);
  }

  @Get('viewport')
  async findInViewport(
    @Query('minLng') minLng: string,
    @Query('minLat') minLat: string,
    @Query('maxLng') maxLng: string,
    @Query('maxLat') maxLat: string,
  ) {
    return this.courtsService.findInViewport(
      parseFloat(minLng),
      parseFloat(minLat),
      parseFloat(maxLng),
      parseFloat(maxLat),
    );
  }

  @Get(':id')
  async getCourtById(@Param('id') id: string) {
    return this.courtsService.getCourtById(id);
  }

  @Post(':id/checkin')
  @UseGuards(JwtAuthGuard, ActiveUserGuard) // 只有激活的实名用户才可以签到 (Task 4.1)
  async checkIn(
    @Request() req: any,
    @Param('id') courtId: string,
    @Body() body: { startTime: string; endTime: string }
  ) {
    const userId = req.user.sub;
    return this.courtsService.checkIn(userId, courtId, body);
  }

  @Get(':id/checkins')
  async getActiveCheckIns(@Param('id') courtId: string) {
    return this.courtsService.getActiveCheckIns(courtId);
  }

  @Post(':id/posts')
  @UseGuards(JwtAuthGuard, ActiveUserGuard) // 只有实名激活的用户才能发留言防刷 (Task 4.2)
  async createPost(
    @Request() req: any,
    @Param('id') courtId: string,
    @Body('content') content: string
  ) {
    const userId = req.user.sub;
    return this.courtsService.createPost(userId, courtId, content);
  }

  @Get(':id/posts')
  async getPosts(
    @Param('id') courtId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string
  ) {
    const s = skip ? parseInt(skip) : 0;
    const t = take ? parseInt(take) : 20;
    return this.courtsService.getPosts(courtId, s, t);
  }
}
