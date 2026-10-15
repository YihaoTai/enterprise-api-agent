import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TeamScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const teamId = req.method === 'GET' ? req.query?.teamId : req.body?.teamId;
    if (
      req.body?.teamId &&
      req.query?.teamId &&
      req.body.teamId !== req.query.teamId
    )
      throw new BadRequestException('Conflicting team scope');
    if (typeof teamId !== 'string' || !teamId || teamId.length > 128)
      throw new BadRequestException('Select a team workspace');
    const member = await this.prisma.teamMember.findUnique({
      where: { teamID_userUid: { teamID: teamId, userUid: req.user.uid } },
    });
    if (!member) throw new ForbiddenException('Team access denied');
    if (
      /\/(sync|retry)$/.test(req.path.replace(/\/+$/, '')) &&
      member.role === 'VIEWER'
    )
      throw new ForbiddenException('Editor role required');
    return true;
  }
}
