# 验证记录

验证日期：2026-10-15（Asia/Shanghai）。

| 验证项 | 结果 | 范围 |
|---|---|---|
| 功能回归 | 7 个测试文件，44 项通过 | RRF、去重、故障降级、Embedding 完整性、索引任务、团队权限、Schema 约束、Mock 修正、RAG 引用、Agent 限额 |
| 后端构建 | 通过 | NestJS 生产代码构建 |
| 前端生产构建 | 通过 | selfhost-web，包括 /knowledge 与原 Mock 页面；原依赖仍输出浏览器兼容警告 |
| PostgreSQL/pgvector 集成 | 通过 | 从升级前备份恢复的隔离数据库；迁移、跨团队同名接口、真实搜索 SQL、租约、旧版本写回拦截、重新入队和重试状态 |
| 本地迁移 | 已成功应用 | 原业务库保留，升级前已 pg_dump 备份；APISpec 另有数据库内归档 |
| 未登录接口保护 | 通过 | /api-search/search、/knowledge/run、/api/mock/generate 均返回 403 |
| 真实 Embedding 服务 | 通过 | 仅合成文本；返回 1024 维有效向量 |
| 真实 LLM 工具调用 | 通过 | 仅合成文本；返回 tool_calls |
| 真实模型 RAG 链路 | 通过 | 合成 API 资料；completed，1 条真实候选来源 |
| 真实模型 Agent 链路 | 通过 | 合成 API 资料；search_apis → get_api → validate_mock，completed，1 份通过结构校验的 Mock |
| UI 交互 | 通过组件级检查 | 原 Vue 组件搭配固定测试数据；模式切换、示例填充、任务结果、来源、Mock 和执行轨迹展示 |
| 全量前端类型检查 | 未通过 | 修复 vue-tsc/TypeScript 版本冲突及声明文件语法错误后，仍有 356 项诊断；本次新增 knowledge.vue、knowledge-api.ts、搜索 helper 及修改后的 aimock.vue 没有诊断 |
| 全仓库测试 | 未宣称通过 | 原仓库还存在测试 fixture 与 password 字段、构造参数不一致等问题，未将本次范围扩大为全仓库测试重构 |

真实模型工作流输出摘要：

```text
rag: status=completed, citations=1, tools=[search_apis, grounded_answer], validatedMocks=0
agent: status=completed, citations=1, tools=[search_apis, get_api, validate_mock], validatedMocks=1
```

这些结果验证链路可运行，不代表真实企业数据集上的检索准确率、业务约束正确率或高并发吞吐。截图 knowledge-preview.png 使用固定样例数据，仅用于界面检查。

源码与数据库备份的 SHA-256 文件保存在相同备份目录。CHANGES.json 以升级前工作副本为基线列出本次变更，避免将用户原有未提交修改当作本次贡献。
