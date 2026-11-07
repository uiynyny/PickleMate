import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PlaySessionService } from './play-session.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../auth/active-user.guard';

@Controller('play-sessions')
export class PlaySessionController {
  constructor(private readonly playSessionService: PlaySessionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async createSession(
    @Request() req: any,
    @Body() body: {
      title: string;
      description?: string;
      courtId: string;
      maxPlayers: number;
      skillMin: number;
      skillMax: number;
      playTime: string;
    }
  ) {
    const userId = req.user.sub;
    return this.playSessionService.createSession(userId, body);
  }

  @Post(':sessionId/join')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async joinSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ) {
    const userId = req.user.sub;
    return this.playSessionService.joinSession(userId, sessionId);
  }

  @Post(':sessionId/leave')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async leaveSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ) {
    const userId = req.user.sub;
    return this.playSessionService.leaveSession(userId, sessionId);
  }

  @Delete(':sessionId')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async cancelSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ) {
    const userId = req.user.sub;
    return this.playSessionService.cancelSession(userId, sessionId);
  }

  @Get()
  async getUpcomingSessions(
    @Query('courtId') courtId?: string,
    @Query('skillLevel') skillLevel?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      courtId,
      skillLevel: skillLevel ? parseFloat(skillLevel) : undefined,
      dateFrom,
      dateTo,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    };
    return this.playSessionService.getUpcomingSessions(filters);
  }

  // Static routes before parameterized routes
  @Get('hosted/sessions')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async getHostedSessions(
    @Request() req: any,
    @Query('upcomingOnly') upcomingOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.sub;
    const filters = {
      upcomingOnly: upcomingOnly !== undefined ? upcomingOnly === 'true' : true,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    };
    return this.playSessionService.getHostedSessions(userId, filters);
  }

  @Get('joined/sessions')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async getJoinedSessions(
    @Request() req: any,
    @Query('upcomingOnly') upcomingOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.sub;
    const filters = {
      upcomingOnly: upcomingOnly !== undefined ? upcomingOnly === 'true' : true,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    };
    return this.playSessionService.getJoinedSessions(userId, filters);
  }

  @Get('invites')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async getMyInvites(@Request() req: any) {
    const userId = req.user.sub;
    return this.playSessionService.getUserInvites(userId);
  }

  // Parameterized routes after static routes
  @Get(':sessionId/recommendations')
  @UseGuards(JwtAuthGuard)
  async getRecommendations(
    @Param('sessionId') sessionId: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.playSessionService.getRecommendations(sessionId, keyword);
  }

  @Get(':sessionId')
  async getSessionById(@Param('sessionId') sessionId: string) {
    return this.playSessionService.getSessionById(sessionId);
  }

  @Post(':sessionId/invite')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async sendInvite(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body('recipientId') recipientId: string,
  ) {
    const userId = req.user.sub;
    return this.playSessionService.sendInvite(userId, sessionId, recipientId);
  }

  @Post('invites/:inviteId/respond')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async respondToInvite(
    @Request() req: any,
    @Param('inviteId') inviteId: string,
    @Body('status') status: 'ACCEPTED' | 'DECLINED',
  ) {
    const userId = req.user.sub;
    return this.playSessionService.respondToInvite(userId, inviteId, status);
  }
}