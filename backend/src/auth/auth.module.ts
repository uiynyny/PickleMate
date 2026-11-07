import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ActiveUserGuard } from './active-user.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'LOCAL_SUPER_SECRET_KEY',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    // Throttler v6: options is an array of throttler configs. ttl is in milliseconds.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: configService.get<number>('THROTTLE_TTL_MS') ?? 60000,
          limit: configService.get<number>('THROTTLE_LIMIT') ?? 20,
        },
        {
          name: 'short',
          ttl: 60000,
          limit: 5,
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, ActiveUserGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, ActiveUserGuard],
})
export class AuthModule {}
