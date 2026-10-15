# 团队协同工作技术方案

## 概述

本文档记录了 Hoppscotch 项目中团队协同功能（邮箱邀请加入团队）的实现方案。

## 技术架构

### 1. 组件概览

| 组件 | 描述 | 位置 |
|------|------|------|
| TeamInvitationService | 团队邀请服务 | `packages/hoppscotch-backend/src/team-invitation/team-invitation.service.ts` |
| TeamService | 团队管理服务 | `packages/hoppscotch-backend/src/team/team.service.ts` |
| TeamInvitationResolver | GraphQL 邀请 mutations | `packages/hoppscotch-backend/src/team-invitation/team-invitation.resolver.ts` |
| TeamInviteeGuard | 被邀请人验证 Guard | `packages/hoppscotch-backend/src/team-invitation/team-invitee.guard.ts` |
| UserService | 用户服务 | `packages/hoppscotch-backend/src/user/user.service.ts` |
| TeamInvitation Model | 邀请数据模型 | `packages/hoppscotch-backend/src/team-invitation/team-invitation.model.ts` |

### 2. 数据模型

#### 2.1 Team（团队）

```
表名: public."Team"
主键: id (text)

字段:
  id     | text | 团队唯一标识 (cuid)
  name   | text | 团队名称
```

#### 2.2 TeamMember（团队成员）

```
表名: public."TeamMember"
主键: id (text, cuid)
外键: teamID → Team.id
      userUid → User.uid

字段:
  id      | text       | 成员记录唯一标识
  role    | TeamAccessRole | OWNER | EDITOR | VIEWER
  userUid | text       | 用户 UID
  teamID  | text       | 团队 ID
```

#### 2.3 TeamInvitation（邀请记录）

```
表名: public."TeamInvitation"
主键: id (text, cuid)
外键: teamID → Team.id

字段:
  id             | text       | 邀请记录唯一标识
  teamID         | text       | 目标团队 ID
  creatorUid     | text       | 邀请创建者 UID
  inviteeEmail   | text       | 被邀请人邮箱（关键：绑定邮箱）
  inviteeRole    | TeamAccessRole | 授予的角色
```

#### 2.4 User（用户）

```
表名: public."User"
主键: uid (text, cuid)
唯一索引: email (text)

核心字段:
  uid           | text     | 用户唯一标识
  email         | text     | 用户邮箱（唯一）
  displayName   | text     | 显示名称
  password      | text     | bcrypt 哈希密码（可选，SSO 用户为空）
  isAdmin       | boolean  | 是否管理员
  refreshToken  | text     | 哈希 refresh token
  createdOn     | timestamptz | 创建时间
```

### 3. 邀请流程

```
邀请流程（邮箱邀请制）:

1. 创建邀请 (团队 Owner)
   POST /graphql
   mutation {
     createTeamInvitation(
       teamID: "xxx",
       inviteeEmail: "user@example.com",
       inviteeRole: EDITOR
     ) {
       id                    # 返回邀请 ID
     }
   }
         ↓
2. 生成邀请链接
   http://localhost:3000/join-team?id={inviteID}
         ↓
3. 被邀请人登录（必须使用邀请时的邮箱）
         ↓
4. 访问邀请链接
         ↓
5. 接受邀请
   POST /graphql
   mutation {
     acceptTeamInvitation(inviteID: "xxx") {
       role
       user { uid email }
     }
   }
         ↓
6. 成为团队成员 (TeamMember)
```

### 4. 核心代码解析

#### 4.1 创建邀请 - createTeamInvitation

```typescript
// team-invitation.service.ts
async createInvitation(
  creator: AuthUser,           // 邀请创建者（当前用户）
  teamID: string,             // 目标团队 ID
  inviteeEmail: string,       // 被邀请人邮箱
  inviteeRole: TeamAccessRole, // 授予角色
) {
  // 1. 验证团队存在
  // 2. 验证当前用户是团队 OWNER
  // 3. 检查被邀请人邮箱格式
  // 4. 创建邀请记录并返回
}
```

#### 4.2 接受邀请 - acceptTeamInvitation

```typescript
// team-invitation.service.ts
async acceptInvitation(inviteID: string, acceptedBy: AuthUser) {
  // 1. 检查邀请是否存在
  const invitation = await this.getInvitation(inviteID);

  // 2. 验证当前用户邮箱与邀请邮箱匹配
  if (user.email !== invitation.inviteeEmail) {
    return E.left(TEAM_INVITE_EMAIL_DO_NOT_MATCH);
  }

  // 3. 检查用户是否已是团队成员
  // 4. 创建 TeamMember 记录
  return E.right(teamMember);
}
```

#### 4.3 安全守卫 - TeamInviteeGuard

```typescript
// team-invitee.guard.ts
@Injectable()
export class TeamInviteeGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 获取当前登录用户
    const { user } = gqlExecCtx.getContext().req;

    // 2. 获取邀请信息
    const invitation = await this.teamInviteService.getInvitation(inviteID);

    // 3. 核心验证：用户邮箱必须与邀请邮箱匹配
    if (user.email.toLowerCase() !== invitation.value.inviteeEmail.toLowerCase()) {
      throwErr(TEAM_INVITE_EMAIL_DO_NOT_MATCH);  // 403 Forbidden
    }

    return true;
  }
}
```

### 5. GraphQL API

| Mutation | 描述 | 所需权限 |
|----------|------|----------|
| `createTeamInvitation(teamID, inviteeEmail, inviteeRole)` | 创建邀请 | 团队 OWNER |
| `acceptTeamInvitation(inviteID)` | 接受邀请 | 被邀请人（邮箱验证） |
| `revokeTeamInvitation(inviteID)` | 撤销邀请 | 团队 OWNER |

| Query | 描述 | 所需权限 |
|-------|------|----------|
| `teamInvitation(inviteID)` | 获取邀请详情 | 被邀请人（邮箱验证） |

### 6. 邀请链接格式

```
前端路由: /join-team?id={inviteID}

完整 URL:
http://localhost:3000/join-team?id=cmnwtj8et000ahj2mzs2b1hxd
```

### 7. 数据库查询

```sql
-- 查看所有团队
SELECT id, name FROM "Team";

-- 查看团队成员
SELECT tm.*, u.email
FROM "TeamMember" tm
JOIN "User" u ON tm."userUid" = u.uid
WHERE tm."teamID" = 'cmnsxskif0001jo2mta26ffzp';

-- 查看邀请记录
SELECT * FROM "TeamInvitation";

-- 查看用户
SELECT uid, email, "displayName" FROM "User";
```

### 8. 测试命令

```bash
# 1. 登录（获取 cookie）
curl -X POST "http://localhost:3170/v1/auth/signin-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"xxx"}' \
  -c cookies.txt

# 2. 创建邀请（需团队 OWNER）
curl -X POST "http://localhost:3170/graphql" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"query":"mutation { createTeamInvitation(teamID: \"team-id\", inviteeEmail: \"target@example.com\", inviteeRole: EDITOR) { id } }"}'

# 3. 接受邀请（需被邀请人登录）
curl -X POST "http://localhost:3170/graphql" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"query":"mutation { acceptTeamInvitation(inviteID: \"invite-id\") { role } }"}'

# 4. 获取用户信息
curl -X POST "http://localhost:3170/graphql" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"query":"query { me { uid email teams { id name } } }"}'
```

## 文件清单

### 后端文件
- `packages/hoppscotch-backend/src/team-invitation/team-invitation.service.ts` - 邀请服务
- `packages/hoppscotch-backend/src/team-invitation/team-invitation.resolver.ts` - GraphQL mutations
- `packages/hoppscotch-backend/src/team-invitation/team-invitee.guard.ts` - 被邀请人验证
- `packages/hoppscotch-backend/src/team-invitation/team-invitation.model.ts` - 数据模型
- `packages/hoppscotch-backend/src/team/team.service.ts` - 团队服务
- `packages/hoppscotch-backend/src/user/user.service.ts` - 用户服务

### 数据库表
- `public.Team` - 团队表
- `public.TeamMember` - 团队成员表
- `public.TeamInvitation` - 邀请记录表
- `public.User` - 用户表

## 当前限制

1. **邮箱绑定限制**: 邀请是绑定邮箱的，被邀请人必须使用指定的邮箱登录才能接受邀请
2. **仅支持邀请制**: 不支持生成无邮箱限制的邀请链接

## 待优化

1. **邀请码机制**: 支持生成一次性邀请码，任何人可凭码加入
2. **公开团队**: 支持设置团队为公开，任何人可申请加入
3. **权限管理**: 支持更细粒度的角色权限控制
