# cURL 导入导出模块

## 概述

本模块负责将 cURL 命令解析为 Hoppscotch REST 请求对象，以及将 REST 请求导出为 cURL 命令。

## 目录结构

```
curl/
├── index.ts          # 入口文件
├── curlparser.ts     # 核心解析器
└── sub_helpers/      # 辅助模块
    ├── auth.ts
    ├── body.ts
    ├── contentParser.ts
    ├── cookies.ts
    ├── headers.ts
    ├── method.ts
    ├── preproc.ts
    ├── queries.ts
    └── url.ts
```

## 模块说明

### index.ts

入口文件，提供两个核心导出：

- `parseCurlToHoppRESTReq(curlCommand: string): HoppRESTRequest` - 将 cURL 解析为请求对象
- `hoppRESTReqToCurl(req: HoppRESTRequest): string` - 将请求对象转换为 cURL

### curlparser.ts

核心解析器，使用 `yargs-parser/browser` 解析命令行参数，通过各 sub_helpers 模块分别处理：
- 请求头、Cookie、方法、URL、认证、请求体、查询参数

### sub_helpers/

| 模块 | 功能 |
|------|------|
| `auth.ts` | 解析 Basic/Bearer/API Key/OAuth2 认证 |
| `body.ts` | 处理 JSON/FormData/Raw 请求体 |
| `contentParser.ts` | Content-Type 解析 |
| `cookies.ts` | Cookie 提取转换 |
| `headers.ts` | Header 解析 |
| `method.ts` | HTTP 方法提取 |
| `preproc.ts` | cURL 命令预处理 |
| `queries.ts` | 查询参数处理 |
| `url.ts` | URL 解析和规范化 |

## 依赖

- `yargs-parser/browser` - 命令行参数解析
- `fp-ts` - 函数式编程 (Option, pipe)
- `@hoppscotch/data` - 数据类型定义
- `lodash-es` - 深拷贝