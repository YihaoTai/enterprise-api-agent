# Enterprise API Agent

面向企业研发协作的 API 知识库与 Agent 工作流平台，基于 [Hoppscotch](https://github.com/hoppscotch/hoppscotch) 二次开发。

## 核心功能

- **混合检索**：关键词匹配、pgvector 向量检索、加权 RRF 排名融合。
- **RAG 问答**：结合团队接口定义与参数说明生成回答，返回可核对的接口来源。
- **Agent 工具调用**：按需检索接口、读取结构、生成候选 Mock 并通过工具校验；限制执行轮数并记录轨迹。
- **可靠向量索引**：后台任务、内容哈希、源版本与快照校验、任务租约、指数退避与手动重试。
- **团队协作**：JWT 认证，Owner / Editor / Viewer 权限，团队接口隔离。
- **Mock 校验**：Schema 推断、字段语义分析、显式约束保留、错误反馈与有限次数修正。

## 技术栈

Vue 3 · TypeScript · NestJS · Prisma · PostgreSQL · pgvector · OpenAI-compatible LLM APIs

## 本地启动

需要 Node.js 22+、pnpm 10.29.3、启用 vector 扩展的 PostgreSQL，以及支持 tool_calls 的聊天模型与独立 Embedding 服务。

```bash
cp .env.example .env
cp .env.example packages/hoppscotch-backend/.env
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @hoppscotch/data build
pnpm --filter @hoppscotch/kernel build
pnpm --filter hoppscotch-backend exec prisma generate
```

配置后端 .env 中的数据库连接、32 字符 DATA_ENCRYPTION_KEY 和模型服务。加密密钥应独立生成，并在后续运行中保持一致：

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

已有 Hoppscotch 数据库使用 Prisma migrate deploy 应用升级。原项目存在历史手动建表差异，全新数据库的完整初始化仍需按迁移记录核对；本次已验证的是从已有项目数据库升级。

```bash
cd packages/hoppscotch-backend
pnpm exec prisma migrate deploy
cd ../..
pnpm dev:knowledge
```

登录后选择团队工作区，打开 `/knowledge`。模型配置说明见 [配置示例](docs/upgrade/model.env.example)。

## 验证与文档

```bash
pnpm test:knowledge
pnpm --filter hoppscotch-backend build
pnpm --filter @hoppscotch/selfhost-web build
```

本次验证：7 个测试文件、44 项回归测试通过；前后端构建通过；真实模型 RAG / Agent 链路通过。全量前端类型检查仍有已记录的诊断，详见 [验证记录](docs/upgrade/VALIDATION.md)。

- [架构、配置与升级边界](docs/upgrade/README.md)
- [项目描述](docs/upgrade/RESUME.md)
- [发布文件说明](docs/PUBLISHING.md)

## 开源来源与许可证

本项目保留 Hoppscotch 的 MIT 许可证及版权声明。二次开发集中于接口混合检索、RAG、Agent、Mock 校验和索引可靠性；原平台能力归原开源项目及贡献者所有。参见 [LICENSE](LICENSE) 和 [上游说明](docs/upstream/HOPPSCOTCH_README.md)。
