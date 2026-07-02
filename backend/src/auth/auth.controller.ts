import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
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
}
