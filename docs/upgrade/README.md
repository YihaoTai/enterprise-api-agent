# 企业研发知识库与 Agent 工作流升级

本次升级保留 Hoppscotch 的 Vue 3 / NestJS / PostgreSQL 技术栈，把已有 API 混合检索与智能 Mock 连接成研发助手。知识来源仍然是团队 API 资产，不是通用 PDF/Word 文档知识库。

## 功能与实现

- **RAG 问答**：团队内混合检索 → 读取接口结构 → 注入证据 → 生成带接口来源的回答；无结果时不调用模型编造答案，返回的来源 ID 必须属于已读取的接口。
- **Agent**：模型通过 tool_calls 自主选择 `search_apis`、`get_api`、`validate_mock`。模型生成候选 Mock 后调用校验工具，错误反馈进入下一轮上下文。最多 6 轮，每轮最多 1 个工具调用，含时间预算检查；没有任意 HTTP 执行、接口修改或删除工具。
- **团队权限**：搜索、索引状态、问答和任务历史要求登录并校验团队成员；索引同步/重试要求 Editor 或 Owner。工具调用再次检查权限，接口 ID 必须属于当前团队。历史只展示当前用户在当前团队的任务。
- **混合检索修复**：使用一基排名的加权 RRF，`score = 1/(60+keywordRank) + 2/(60+vectorRank)`，按 requestId 去重。修复原来关键词分数未转换、向量独有结果键不一致的问题。支持包含已知词条的复合查询扩展。
- **可靠索引**：APISpec 持久化 pending/processing/ready/failed 状态、内容哈希、源快照、版本、模型标识、租约及重试次数。后台轮询补偿漏掉的变更事件，失败指数退避，最多 5 次后可手动重试。生成结果只有在哈希、租约和源内容均匹配时才能写回。搜索过滤过期、被删除或不兼容模型的向量。
- **向量质量**：取消 API 失败后的哈希伪向量；失败时保留关键词检索。Embedding 和聊天模型分别配置，检查维数、有限值及非零范数。保留旧库 vector(1024) 的兼容投影并归一化，模型标识记录该策略。
- **Mock 校验**：JSON 模板入口与 generate 入口统一走推断/语义分析/生成/校验流程，最多 3 次生成修正。保留显式约束，不再静默强制转换模型输出。支持对象、数组、必填、额外字段限制、数值范围、字符串/数组长度、enum 与部分格式校验；未知 Schema 关键字明确拒绝。
- **界面**：侧边栏新增“研发助手”（`/knowledge`），提供问答/Agent 模式、来源、校验成功的 Mock、工具轨迹、索引状态、同步/重试和最近任务。切换团队后清除旧结果并忽略旧请求返回。

## 启动

项目根目录：

```bash
pnpm dev:knowledge
```

默认前端地址为 http://127.0.0.1:3000 ，后端端口取原有配置（本地为 3170）。登录后在顶部选择团队工作区，再进入 `/knowledge`。个人工作区不进行跨团队搜索。

启动脚本优先读取 `packages/hoppscotch-backend/.env`，再从根目录 `.env` 补齐缺失配置。两处的 DATA_ENCRYPTION_KEY 原本不同；必须保留后端配置中与数据库对应的密钥，不能随意替换。已有配置内容未修改。

| 配置 | 作用 |
|---|---|
| LLM_BASE_URL / LLM_API_KEY / LLM_MODEL | 聊天模型；Agent 模式需要兼容 tool_calls |
| EMBEDDING_BASE_URL | 向量服务地址，默认阿里云兼容地址 |
| EMBEDDING_API_KEY | 独立向量服务凭据；缺省时回退 LLM_API_KEY |
| EMBEDDING_MODEL | 默认 text-embedding-v1 |
| API_INDEX_WORKER | 默认开启；设 false 暂停后台索引 |
| VITE_BACKEND_API_URL | 前端后端地址，生产环境应显式配置 |

模型标识或配置发生变化会触发后台重建。索引仅发送接口名称、说明、方法、去掉查询串的路径、字段名和数据形状；不发送请求头凭据值、查询参数值或样例体的具体值。自然语言说明本身仍会发送给配置的模型供应商。

## 数据库与备份

升级前源码压缩包：
`/Users/yihao/project-backups/hoppscotch-before-upgrade-20261015-014811.tar.gz`

升级前 PostgreSQL 自定义格式备份：
`/Users/yihao/project-backups/hoppscotch-database-before-upgrade-20261015.dump`

源码包包含 .git、本地 .env 和所有未提交/未跟踪源码；不包含 node_modules、dist、coverage、.cache 等可重建内容。备份权限为仅当前用户可读写。

已在本地数据库应用：
- `20260410150000_api_spec_headers_body`：原本存在但尚未登记的 API 索引迁移，修复了数据库端不存在的 cuid() 默认值并提前创建扩展。
- `20261015010000_knowledge_workflows`：保存旧 APISpec 到归档表、兼容旧整数 ID、按 requestId 规范唯一性，添加索引任务状态和 KnowledgeRun 表。

旧向量表完整副本保存在 `APISpecUpgradeArchive`。原 TeamRequest、团队和用户业务记录不做清空操作。新任务历史以 JSON 存储来源和执行轨迹；部署前应按组织需求增加保留期限策略。

## 验证

```bash
pnpm test:knowledge
pnpm --filter hoppscotch-backend build
pnpm --filter @hoppscotch/selfhost-web build
pnpm check:models
node scripts/check-knowledge-workflow.cjs
```

最后两项会使用现有模型配置，只发送合成测试数据，并消耗少量模型配额。

隔离数据库验证脚本：`scripts/verify-knowledge-db.cjs`。它从升级前备份恢复到 `hoppscotch_upgrade_verify_20261015`，不覆盖已存在的测试库。验证包含真实 PostgreSQL/pgvector SQL、跨团队隔离、同步任务租约、旧结果写回拦截和失败重试。测试业务记录使用事务回滚。该测试库已保留供复查。

本次 7 个测试文件共 44 项回归测试通过。测试记录详见 `VALIDATION.md`。UI 截图来自真实 Vue 组件加固定测试数据，不能用作真实检索效果或模型质量的证明。

## 回滚

1. 停止本项目的前后端进程。
2. 将源码压缩包解压到一个新的恢复目录，例如 `~/project-backups/restore-review/`；确认内容后再切换运行目录，避免覆盖升级后的新增工作。
3. 使用 `createdb` 创建新的恢复数据库，再使用 `pg_restore --no-owner --no-privileges -d <恢复库名> <备份文件>` 导入。需预先在恢复库启用 vector 扩展；本地普通项目账号没有创建该扩展的权限时，由数据库管理员处理。
4. 在恢复目录的后端 .env 中仅将 DATABASE_URL 指向恢复库，保留备份中的 DATA_ENCRYPTION_KEY。
5. 安装锁文件对应依赖并启动恢复版本。不要直接在升级库执行破坏性的反向 SQL。

## 当前边界

- 没有做通用文档上传、OCR、文档分块、独立 reranker、多 Agent 或真实 HTTP 自动执行。
- 历史与索引任务可持久化；Agent 正在运行的模型会话不支持进程重启续跑，也没有流式输出。请求中断不等于取消后台任务。
- 检索目前仍使用 PostgreSQL LIKE 与精确向量距离排序，没有宣称百万级吞吐或给出未经测量的准确率；需要真实数据评测后再选索引、批量同步和权重。
- RRF 解决评分尺度差异，不保证“修改成员姓名”一类查询的业务最优排序；需要评测集和显式意图/权限约束持续验证。
- Schema 子集不是完整 JSON Schema 实现。不支持 pattern、$ref、oneOf 等时会明确报错。样例推断只保证结构/类型，不能推断外键存在性等业务条件。
- RAG 校验来源 ID 的真实性，不等于自动证明每个自然语言断言均被来源支持。Agent 的最终自然语言说明也需要结合来源核对；只有单独显示的 validatedMocks 才由服务端实际校验通过。
- 原仓库全量类型检查仍存在既存错误，不能将本次功能测试通过表述为全仓库零缺陷或生产验收通过。
