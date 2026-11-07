import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AuthService {
  private otpMap = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
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
  async verifyOtpAndLogin(phone: string, code: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
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

    // 生成 access token 和 refresh token
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateAndSaveRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  /**
   * Apple 快捷登录（查找或创建未激活用户）
   */
  async appleLogin(appleUserId: string, nickname?: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
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

    // 生成 access token 和 refresh token
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateAndSaveRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  /**
   * 绑定手机号（将未激活用户升级为激活用户）
   */
  async linkPhone(userId: string, phone: string, code: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
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

    // 生成 access token 和 refresh token
    const accessToken = await this.generateAccessToken(updatedUser);
    const refreshToken = await this.generateAndSaveRefreshToken(updatedUser);

    return {
      accessToken,
      refreshToken,
      user: updatedUser,
    };
  }

  /**
   * 微信小程序登录（接收 wx.login 返回的 code，换取 openid 和 unionid）
   * 如果是新用户则创建，否则返回现有用户
   * 如果用户已有手机号或 appleUserId，则视为已绑定，直接登录
   */
  async wechatLogin(code: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    if (!code) {
      throw new BadRequestException('微信登录 code 不能为空');
    }

    const appId = this.configService.get<string>('WECHAT_APPID');
    const secret = this.configService.get<string>('WECHAT_SECRET');
    if (!appId || !secret) {
      throw new Error('WeChat appid or secret not configured');
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

    try {
      const response = await axios.get(url);
      const data = response.data;

      if (data.errcode) {
        throw new BadRequestException(`微信登录失败: ${data.errmsg}`);
      }

      const { openid, unionid } = data;
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { wechatOpenId: openid },
            { wechatUnionId: unionid ?? null }, // unionid 可能为 null
          ],
        },
      });

      // 如果未找到用户，则创建新用户
      if (!user) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        user = await this.prisma.user.create({
          data: {
            wechatOpenId: openid,
            wechatUnionId: unionid ?? null,
            nickname: `微信用户_${randomSuffix}`,
            avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?wechat_${openid}`,
          },
        });
      }

      // 生成 access token 和 refresh token
      const accessToken = await this.generateAccessToken(user);
      const refreshToken = await this.generateAndSaveRefreshToken(user);

      return {
        accessToken,
        refreshToken,
        user,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('微信登录请求失败，请稍后重试');
    }
  }

  /**
   * 使用 refresh token 获取新的 access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // 验证 refresh token
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new BadRequestException('无效的刷新令牌');
    }

    // 检查是否过期
    if (tokenRecord.expiresAt < new Date()) {
      // 删除过期的 refresh token
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
      throw new BadRequestException('刷新令牌已过期');
    }

    // 生成新的 access token
    const accessToken = await this.generateAccessToken(tokenRecord.user);

    return {
      accessToken,
    };
  }

  /**
   * 生成 access token
   */
  private async generateAccessToken(user: any): Promise<string> {
    const payload = {
      sub: user.id,
      phone: user.phone ?? undefined,
      nickname: user.nickname
    };
    return await this.jwtService.signAsync(payload);
  }

  /**
   * 生成并保存 refresh token
   */
  private async generateAndSaveRefreshToken(user: any): Promise<string> {
    // 生成随机的 refresh token
    const refreshToken = Math.random().toString(36).substring(2, 15) +
                        Math.random().toString(36).substring(2, 15);

    // 设置过期时间（例如 30 天）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 保存到数据库
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: expiresAt,
      },
    });

    return refreshToken;
  }

  /**
   * 删除指定用户的所有 refresh token（用于登出或安全事件）
   */
  async revokeRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * 验证 refresh token 是否有效
   */
  async validateRefreshToken(refreshToken: string): Promise<boolean> {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord) {
      return false;
    }

    return tokenRecord.expiresAt >= new Date();
  }
}