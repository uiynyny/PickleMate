import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class PlaySessionService {
  private static readonly INVITE_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Create a new play session
   */
  async createSession(userId: string, dto: {
    title: string;
    description?: string;
    courtId: string;
    maxPlayers: number;
    skillMin: number;
    skillMax: number;
    playTime: string; // ISO date string
  }) {
    const { title, description, courtId, maxPlayers, skillMin, skillMax, playTime } = dto;

    // Validate court exists
    const courtExists = await this.prisma.court.findUnique({
      where: { id: courtId },
    });

    if (!courtExists) {
      throw new NotFoundException('Court not found');
    }

    // Validate user exists
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      throw new NotFoundException('User not found');
    }

    // Validate time
    const playTimeDate = new Date(playTime);
    if (isNaN(playTimeDate.getTime())) {
      throw new BadRequestException('Invalid play time format');
    }

    if (playTimeDate <= new Date()) {
      throw new BadRequestException('Play time must be in the future');
    }

    // Validate skill range
    if (skillMin < 0 || skillMin > 5 || skillMax < 0 || skillMax > 5) {
      throw new BadRequestException('Skill levels must be between 0 and 5');
    }

    if (skillMin > skillMax) {
      throw new BadRequestException('Minimum skill cannot be greater than maximum skill');
    }

    // Validate maxPlayers
    if (maxPlayers < 1) {
      throw new BadRequestException('Maximum players must be at least 1');
    }

    // Create the session
    const session = await this.prisma.playSession.create({
      data: {
        title,
        description,
        courtId,
        hostId: userId,
        maxPlayers,
        skillMin,
        skillMax,
        playTime: playTimeDate,
      },
      include: {
        host: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            skillLevel: true,
          },
        },
        court: {
          select: {
            id: true,
            name: true,
            address: true,
            isIndoor: true,
            hasLights: true,
          },
        },
      },
    });

    return session;
  }

  /**
   * Join a play session as a player
   */
  async joinSession(userId: string, sessionId: string) {
    // Check if session exists
    const sessionExists = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
      include: {
        _count: {
          select: { players: true },
        },
      },
    });

    if (!sessionExists) {
      throw new NotFoundException('Session not found');
    }

    // Check if user is already in the session
    const isAlreadyJoined = await this.prisma.playSession.findFirst({
      where: {
        id: sessionId,
        players: {
          some: {
            id: userId,
          },
        },
      },
    });

    if (isAlreadyJoined) {
      throw new BadRequestException('You have already joined this session');
    }

    // Check if session is full
    if (sessionExists._count.players >= sessionExists.maxPlayers) {
      throw new BadRequestException('Session is full');
    }

    // Check if user's skill level matches requirements (if they have a skill level)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { skillLevel: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.skillLevel !== null && user.skillLevel !== undefined) {
      if (user.skillLevel < sessionExists.skillMin || user.skillLevel > sessionExists.skillMax) {
        throw new BadRequestException(
          `Your skill level (${user.skillLevel}) does not meet the session requirements (${sessionExists.skillMin}-${sessionExists.skillMax})`,
        );
      }
    }

    // Add user to session
    return this.prisma.playSession.update({
      where: { id: sessionId },
      data: {
        players: {
          connect: { id: userId },
        },
      },
      include: {
        host: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            skillLevel: true,
          },
        },
        court: {
          select: {
            id: true,
            name: true,
            address: true,
            isIndoor: true,
            hasLights: true,
          },
        },
        players: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            skillLevel: true,
          },
          take: 10, // Limit to avoid returning too much data
        },
      },
    });
  }

  /**
   * Leave a play session
   */
  async leaveSession(userId: string, sessionId: string) {
    // Check if session exists
    const sessionExists = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
    });

    if (!sessionExists) {
      throw new NotFoundException('Session not found');
    }

    // Check if user is in the session
    const isInSession = await this.prisma.playSession.findFirst({
      where: {
        id: sessionId,
        players: {
          some: {
            id: userId,
          },
        },
      },
    });

    if (!isInSession) {
      throw new BadRequestException('You are not in this session');
    }

    // Check if user is the host (host cannot leave, they must cancel instead)
    if (sessionExists.hostId === userId) {
      throw new BadRequestException('Host cannot leave the session. Use cancel instead.');
    }

    // Remove user from session
    return this.prisma.playSession.update({
      where: { id: sessionId },
      data: {
        players: {
          disconnect: { id: userId },
        },
      },
      include: {
        host: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            skillLevel: true,
          },
        },
        court: {
          select: {
            id: true,
            name: true,
            address: true,
            isIndoor: true,
            hasLights: true,
          },
        },
        players: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            skillLevel: true,
          },
          take: 10,
        },
      },
    });
  }

  /**
   * Cancel a session (only host can do this)
   */
  async cancelSession(userId: string, sessionId: string) {
    // Check if session exists and user is the host
    const session = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
      include: {
        host: true,
        _count: {
          select: { players: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.hostId !== userId) {
      throw new BadRequestException('Only the host can cancel the session');
    }

    // Delete the session
    return this.prisma.playSession.delete({
      where: { id: sessionId },
    });
  }

  /**
   * Get upcoming sessions (filterable by various criteria)
   */
  async getUpcomingSessions(filters: {
    courtId?: string;
    skillLevel?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const {
      courtId,
      skillLevel,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      playTime: {
        gt: new Date(), // Only future sessions
      },
    };

    if (courtId) {
      where.courtId = courtId;
    }

    if (skillLevel !== undefined && skillLevel !== null) {
      where.AND = [
        { skillMin: { lte: skillLevel } },
        { skillMax: { gte: skillLevel } },
      ];
    }

    if (dateFrom) {
      where.playTime = {
        ...where.playTime,
        gte: new Date(dateFrom),
      };
    }

    if (dateTo) {
      where.playTime = {
        ...where.playTime,
        lte: new Date(dateTo),
      };
    }

    // Get sessions and count
    const [sessions, total] = await Promise.all([
      this.prisma.playSession.findMany({
        where,
        include: {
          host: {
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
              skillLevel: true,
            },
          },
          court: {
            select: {
              id: true,
              name: true,
              address: true,
              isIndoor: true,
              hasLights: true,
            },
          },
          _count: {
            select: { players: true },
          },
        },
        orderBy: {
          playTime: 'asc',
        },
        skip,
        take: limit,
      }),
      this.prisma.playSession.count({ where }),
    ]);

    return {
      data: sessions.map(session => ({
        ...session,
        playerCount: session._count.players,
        isFull: session._count.players >= session.maxPlayers,
        _count: undefined, // Remove the internal _count field
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get session details by ID
   */
  async getSessionById(sessionId: string) {
    const session = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
      include: {
        host: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            skillLevel: true,
          },
        },
        court: {
          select: {
            id: true,
            name: true,
            address: true,
            isIndoor: true,
            hasLights: true,
          },
        },
        players: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            skillLevel: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return {
      ...session,
      playerCount: session.players.length,
      isFull: session.players.length >= session.maxPlayers,
    };
  }

  /**
   * Get sessions hosted by a specific user
   */
  async getHostedSessions(userId: string, filters: {
    upcomingOnly?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    const { upcomingOnly = true, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      hostId: userId,
    };

    if (upcomingOnly) {
      where.playTime = {
        gt: new Date(),
      };
    }

    const [sessions, total] = await Promise.all([
      this.prisma.playSession.findMany({
        where,
        include: {
          host: {
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
              skillLevel: true,
            },
          },
          court: {
            select: {
              id: true,
              name: true,
              address: true,
              isIndoor: true,
              hasLights: true,
            },
          },
          _count: {
            select: { players: true },
          },
        },
        orderBy: {
          playTime: 'asc',
        },
        skip,
        take: limit,
      }),
      this.prisma.playSession.count({ where }),
    ]);

    return {
      data: sessions.map(session => ({
        ...session,
        playerCount: session._count.players,
        isFull: session._count.players >= session.maxPlayers,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get sessions a user has joined
   */
  async getJoinedSessions(userId: string, filters: {
    upcomingOnly?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    const { upcomingOnly = true, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      players: {
        some: {
          id: userId,
        },
      },
    };

    if (upcomingOnly) {
      where.playTime = {
        gt: new Date(),
      };
    }

    const [sessions, total] = await Promise.all([
      this.prisma.playSession.findMany({
        where,
        include: {
          host: {
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
              skillLevel: true,
            },
          },
          court: {
            select: {
              id: true,
              name: true,
              address: true,
              isIndoor: true,
              hasLights: true,
            },
          },
          _count: {
            select: { players: true },
          },
        },
        orderBy: {
          playTime: 'asc',
        },
        skip,
        take: limit,
      }),
      this.prisma.playSession.count({ where }),
    ]);

    return {
      data: sessions.map(session => ({
        ...session,
        playerCount: session._count.players,
        isFull: session._count.players >= session.maxPlayers,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Send an invitation to a user to join a session
   */
  async sendInvite(userId: string, sessionId: string, recipientId: string) {
    // Validate session exists and user is host
    const session = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.hostId !== userId) {
      throw new BadRequestException('Only the host can send invitations');
    }

    if (recipientId === userId) {
      throw new BadRequestException('You cannot invite yourself');
    }

    // Validate recipient exists
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient user not found');
    }

    // Check if recipient is already a player
    const isAlreadyPlayer = await this.prisma.playSession.findFirst({
      where: {
        id: sessionId,
        players: {
          some: { id: recipientId },
        },
      },
    });

    if (isAlreadyPlayer) {
      throw new BadRequestException('User is already a player in this session');
    }

    // Check for existing pending invite
    const existingInvite = await this.prisma.sessionInvite.findFirst({
      where: {
        sessionId,
        recipientId,
        status: 'PENDING',
      },
    });

    if (existingInvite) {
      throw new BadRequestException('A pending invitation already exists for this user');
    }

    // Create invitation
    const invite = await this.prisma.sessionInvite.create({
      data: {
        sessionId,
        senderId: userId,
        recipientId,
        status: 'PENDING',
      },
    });

    // Notify recipient
    this.notificationsGateway.sendNotification(recipientId, 'invite:sent', {
      inviteId: invite.id,
      sessionId,
      hostNickname: (await this.prisma.user.findUnique({ where: { id: userId } }))?.nickname,
    });

    return invite;
  }

  /**
   * Respond to a session invitation
   */
  async respondToInvite(userId: string, inviteId: string, status: 'ACCEPTED' | 'DECLINED') {
    // Find the invite and verify recipient
    const invite = await this.prisma.sessionInvite.findUnique({
      where: { id: inviteId },
      include: { session: true },
    });

    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }

    if (invite.recipientId !== userId) {
      throw new BadRequestException('You are not the recipient of this invitation');
    }

    if (invite.status !== 'PENDING') {
      throw new BadRequestException('This invitation has already been responded to');
    }

    const session = invite.session;
    const isStale =
      Date.now() - new Date(invite.sentAt).getTime() > PlaySessionService.INVITE_TTL_MS ||
      new Date(session.playTime).getTime() <= Date.now();

    if (isStale) {
      await this.prisma.sessionInvite.update({
        where: { id: inviteId },
        data: { status: 'EXPIRED' },
      });
      this.notificationsGateway.sendNotification(session.hostId, 'invite:expired', {
        inviteId,
        sessionId: session.id,
      });
      throw new BadRequestException('This invitation has expired');
    }

    if (status === 'ACCEPTED') {
      // Check if session is full
      const sessionCount = await this.prisma.playSession.findUnique({
        where: { id: session.id },
        include: {
          _count: { select: { players: true } },
        },
      });

      if (!sessionCount) {
        throw new NotFoundException('Session not found');
      }

      if (sessionCount._count.players >= session.maxPlayers) {
        throw new BadRequestException('Session is now full');
      }

      // Check skill level
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { skillLevel: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.skillLevel !== null && user.skillLevel !== undefined) {
        if (user.skillLevel < session.skillMin || user.skillLevel > session.skillMax) {
          throw new BadRequestException(
            `Your skill level (${user.skillLevel}) does not meet the session requirements (${session.skillMin}-${session.skillMax})`,
          );
        }
      }

      // Add to players and update invite
      const result = await this.prisma.$transaction([
        this.prisma.playSession.update({
          where: { id: session.id },
          data: {
            players: { connect: { id: userId } },
          },
        }),
        this.prisma.sessionInvite.update({
          where: { id: inviteId },
          data: {
            status: 'ACCEPTED',
            respondedAt: new Date(),
          },
        }),
      ]);

      // Notify host
      this.notificationsGateway.sendNotification(session.hostId, 'invite:accepted', {
        inviteId,
        sessionId: session.id,
        playerNickname: (await this.prisma.user.findUnique({ where: { id: userId } }))?.nickname,
      });

      return result;
    } else {
      // Just mark as declined
      const updatedInvite = await this.prisma.sessionInvite.update({
        where: { id: inviteId },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
        },
      });

      // Notify host
      const session = await this.prisma.playSession.findUnique({
        where: { id: invite.sessionId },
      });
      if (session) {
        this.notificationsGateway.sendNotification(session.hostId, 'invite:declined', {
          inviteId,
          sessionId: session.id,
          playerNickname: (await this.prisma.user.findUnique({ where: { id: userId } }))?.nickname,
        });
      }

      return updatedInvite;
    }
  }

  /**
   * Expire stale pending invitations (older than 24h or for past sessions)
   */
  async expireStaleInvites(filter?: { recipientId?: string; sessionId?: string }): Promise<number> {
    const cutoff = new Date(Date.now() - PlaySessionService.INVITE_TTL_MS);
    const now = new Date();
    const where: any = {
      status: 'PENDING',
      OR: [
        { sentAt: { lt: cutoff } },
        { session: { playTime: { lte: now } } },
      ],
    };
    if (filter?.recipientId) {
      where.recipientId = filter.recipientId;
    }
    if (filter?.sessionId) {
      where.sessionId = filter.sessionId;
    }
    const res = await this.prisma.sessionInvite.updateMany({
      where,
      data: { status: 'EXPIRED' },
    });
    return res.count;
  }

  /**
   * Get pending invitations for a user
   */
  async getUserInvites(userId: string) {
    await this.expireStaleInvites({ recipientId: userId });

    return this.prisma.sessionInvite.findMany({
      where: {
        recipientId: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
        session: {
          include: {
            host: {
              select: {
                id: true,
                nickname: true,
                avatarUrl: true,
              },
            },
            court: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        sentAt: 'desc',
      },
    });
  }

  /**
   * Recommend skill-matched active users to invite to a session
   */
  async getRecommendations(sessionId: string, keyword?: string) {
    const session: any = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
      include: {
        players: { select: { id: true } },
        invites: {
          where: { status: 'PENDING' },
          select: { recipientId: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const excludedIds = Array.from(
      new Set([
        session.hostId,
        ...(session.players || []).map((p: any) => p.id),
        ...(session.invites || []).map((i: any) => i.recipientId),
      ]),
    );

    const where: any = {
      id: { notIn: excludedIds },
      phone: { not: null },
      OR: [
        {
          skillLevel: {
            gte: session.skillMin,
            lte: session.skillMax,
          },
        },
        { skillLevel: null },
      ],
    };

    if (keyword && keyword.trim()) {
      where.nickname = { contains: keyword.trim(), mode: 'insensitive' };
    }

    const candidates = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        skillLevel: true,
        bio: true,
      },
      take: 20,
    });

    const midpoint = (session.skillMin + session.skillMax) / 2;
    return candidates.sort((a: any, b: any) => {
      const aHasSkill = a.skillLevel !== null && a.skillLevel !== undefined;
      const bHasSkill = b.skillLevel !== null && b.skillLevel !== undefined;
      if (aHasSkill && !bHasSkill) return -1;
      if (!aHasSkill && bHasSkill) return 1;
      if (!aHasSkill && !bHasSkill) return 0;
      return Math.abs(a.skillLevel - midpoint) - Math.abs(b.skillLevel - midpoint);
    });
  }
}