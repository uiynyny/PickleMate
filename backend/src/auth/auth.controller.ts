import { Controller, Post, Body, UseGuards, Request, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';

@Controller('auth')
@UseGuards(ThrottlerGuard) // 全局速率限制覆盖所有 auth 端点；OTP 端点使用更紧的 short 限流
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @Throttle({ short: { ttl: 60000, limit: 5 } }) // 每分钟最多 5 次请求，防止短信接口被刷
  @SkipThrottle({ default: true }) // 仅应用 short 限流，放宽默认限流
  async requestOtp(@Body('phone') phone: string) {
    return this.authService.requestOtp(phone);
  }

  @Post('otp/verify')
  async verifyOtp(@Body('phone') phone: string, @Body('code') code: string) {
    return this.authService.verifyOtpAndLogin(phone, code);
  }

  @Post('apple/login')
  async appleLogin(
    @Body('appleUserId') appleUserId: string,
    @Body('nickname') nickname?: string,
  ) {
    return this.authService.appleLogin(appleUserId, nickname);
  }

  @Post('phone/link')
  @UseGuards(JwtAuthGuard)
  async linkPhone(
    @Request() req: any,
    @Body('phone') phone: string,
    @Body('code') code: string,
  ) {
    const userId = req.user.sub;
    return this.authService.linkPhone(userId, phone, code);
  }

  @Post('wechat/login')
  async wechatLogin(@Body('code') code: string) {
    return this.authService.wechatLogin(code);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: any) {
    const userId = req.user.sub;
    await this.authService.revokeRefreshTokens(userId);
    return { message: '成功登出' };
  }
}
