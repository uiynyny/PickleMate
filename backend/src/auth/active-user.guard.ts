import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.phone) {
      throw new ForbiddenException('必须绑定手机号（激活用户）才能执行此写操作');
    }
    return true;
  }
}
