import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private otpMap = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * 生成 4 位短信验证码，并打印到控制台模拟短信发送
   */
  async requestOtp(phone: string): Promise<{ message: string; code: string }> {
    if (!phone || phone.length < 8) {
      throw new BadRequestException('无效的手机号格式');
    }

    // 生成随机 4 位数字
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效期

    this.otpMap.set(phone, { code, expiresAt });

    // 模拟短信输出，方便本地测试
    console.log(`\n==========================================`);
    console.log(`[短信验证码] 接收手机号: ${phone} | 验证码: ${code}`);
    console.log(`==========================================\n`);

    return {
      message: '验证码已发送（开发测试环境下已输出到后端控制台）',
      code,
    };
  }

  /**
   * 校验验证码并实现手机号注册/登录
   */
  async verifyOtpAndLogin(phone: string, code: string): Promise<{ accessToken: string; user: any }> {
    const record = this.otpMap.get(phone);
    if (!record) {
      throw new BadRequestException('请先请求发送验证码');
    }

    if (Date.now() > record.expiresAt) {
      this.otpMap.delete(phone);
      throw new BadRequestException('验证码已过期，请重新获取');
    }

    if (record.code !== code) {
      throw new BadRequestException('验证码错误');
    }

    // 验证成功，清除验证码记录
    this.otpMap.delete(phone);

    // 查询或创建用户
    let user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      user = await this.prisma.user.create({
        data: {
          phone,
          nickname: `球友_${randomSuffix}`,
          avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${phone}`,
        },
      });
    }

    const payload = { sub: user.id, phone: user.phone, nickname: user.nickname };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user,
    };
  }

  /**
   * Apple 快捷登录（查找或创建未激活用户）
   */
  async appleLogin(appleUserId: string, nickname?: string): Promise<{ accessToken: string; user: any }> {
    if (!appleUserId) {
      throw new BadRequestException('appleUserId 不能为空');
    }

    let user = await this.prisma.user.findUnique({
      where: { appleUserId },
    });

    if (!user) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      user = await this.prisma.user.create({
        data: {
          appleUserId,
          nickname: nickname || `Apple球友_${randomSuffix}`,
          avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${appleUserId}`,
        },
      });
    }

    const payload = { sub: user.id, phone: user.phone, nickname: user.nickname };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user,
    };
  }

  /**
   * 绑定手机号（将未激活用户升级为激活用户）
   */
  async linkPhone(userId: string, phone: string, code: string): Promise<{ accessToken: string; user: any }> {
    const record = this.otpMap.get(phone);
    if (!record) {
      throw new BadRequestException('请先请求发送验证码');
    }

    if (Date.now() > record.expiresAt) {
      this.otpMap.delete(phone);
      throw new BadRequestException('验证码已过期，请重新获取');
    }

    if (record.code !== code) {
      throw new BadRequestException('验证码错误');
    }

    this.otpMap.delete(phone);

    // 检查该手机号是否已被其他用户绑定
    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('该手机号已被其他账号绑定，请更换手机号');
    }

    // 绑定手机号
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { phone },
    });

    // 重新签发带有手机号状态的 JWT 令牌
    const payload = { sub: updatedUser.id, phone: updatedUser.phone, nickname: updatedUser.nickname };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: updatedUser,
    };
  }
}
