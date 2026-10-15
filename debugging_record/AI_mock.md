# AI Mock 功能集成记录

## 功能概述

AI Mock 功能集成到 Hoppscotch 项目中，支持两种生成方式：
1. **AI Generate Tab**：输入类型描述，直接调用 DeepSeek API 生成
2. **JSON Input Tab**：输入 JSON 示例，调用后端服务生成

## 技术架构

### 前端 (aimock.vue)
- 页面路径：`/aimock`
- 两个 Tab 切换 UI
- API Key 存储在 localStorage

### 后端 (ai-mock-server.js)
- 端口：4000
- 使用 DeepSeek API (deepseek-chat)
- 支持本地 fallback 生成

## 2026-04-09 更新：切换为 DeepSeek 模型

### 变更内容
- 从 Qwen 模型切换为 DeepSeek 模型
- 后端服务支持传递 API Key
- 支持两种生成方式共用 DeepSeek

### 修改文件
- `packages/hoppscotch-backend/ai-mock-server.js` - 改用 DeepSeek API
- `packages/hoppscotch-common/src/pages/aimock.vue` - 前端传递 API Key

### API 端点
- `POST /api/mock/generate` - 生成 Mock 数据
- `POST /api/mock/set-key` - 设置 API Key
- `GET /api/mock/status` - 获取状态

## 2026-04-09 更新：k 值结构权重控制

### 功能
- 新增 k 值参数 (0-1)，控制字段结构在生成时的影响权重
- 前端添加滑块控件实时调整 k 值

### k 值效果
| k 值 | 结构信息 | 强制程度 |
|-----|---------|---------|
| 0 | 忽略结构 | 无 |
| 0.3 | 简单类型提示 | 仅供参考 |
| 0.5 | 主要类型分布 | 建议遵循 |
| 0.8 | 详细字段信息 | 尽量遵循 |
| 1.0 | 完整结构 + 强制 | 严格遵循 |

### 实现逻辑
```javascript
// 后端分析字段结构
const analyzeStructure = (obj, path = '') => {
  // 检测类型：string, integer, float, boolean, array, object
  // 检测语言：chinese, english, number_string, date_string, email, url
  // 递归处理嵌套对象
}

// 根据 k 值构建不同强度的提示
const buildStructureHint = (k) => {
  // k 值越高，结构信息越详细
}
```

### 修改文件
- `packages/hoppscotch-backend/ai-mock-server.js` - 添加结构分析逻辑
- `packages/hoppscotch-common/src/pages/aimock.vue` - 添加 k 值滑块

## 测试方法

### 1. AI Generate Tab 测试
1. 切换到 AI Generate Tab
2. 设置 DeepSeek API Key
3. 输入类型描述（如 "用户信息：姓名、年龄、邮箱"）
4. 点击生成，观察结果

### 2. JSON Input Tab 测试
1. 切换到 JSON Input Tab
2. 输入 JSON 示例（如 `{"name": "张三", "age": 25}`）
3. 调整 k 值滑块
4. 点击生成，观察不同 k 值对结果的影响
5. 对比字段类型匹配度、语义合理性等

### 3. k 值对比测试
建议测试用例：
```json
{"name": "test", "age": 18, "email": "a@b.com", "isActive": true}
```

| k 值 | 预期效果 |
|-----|---------|
| 0 | 完全自由生成，可能忽略类型 |
| 0.5 | 平衡类型和语义 |
| 1.0 | 严格匹配类型和结构 |

## 修改文件清单

- `packages/hoppscotch-common/src/pages/aimock.vue` - AI Mock 页面
- `packages/hoppscotch-common/src/components/app/Sidenav.vue` - 导航入口
- `packages/hoppscotch-common/locales/en.json` - 国际化文本
- `packages/hoppscotch-backend/ai-mock-server.js` - 后端服务

## 相关技术

- DeepSeek API (deepseek-chat) - LLM 生成
- 本地随机映射表 - Fallback 保障
- Vue 3 + TypeScript - 前端框架
- Express + CORS - 后端服务