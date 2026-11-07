import { Module } from '@nestjs/common';
import { PlaySessionService } from './play-session.service';
import { PlaySessionController } from './play-session.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule],
  controllers: [PlaySessionController],
  providers: [PlaySessionService],
})
export class PlaySessionModule {}