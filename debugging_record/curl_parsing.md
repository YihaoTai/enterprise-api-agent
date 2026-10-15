# Curl Parsing Debugging Record

## Date: 2026-04-03

## Issue 1: 重复 Header

### 原始输入
```bash
curl -H "Authorization: Bearer token123" \
  -H "X-Request-ID: 12345" \
  -H "Accept: application/json" \
  "https://api.example.com/orders"
```

### 错误输出
```bash
curl \
  -H "Authorization: Bearer token123" \
  -H "Authorization: Bearer token123" \
  -H "X-Request-ID: 12345" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer token123" \
  "https://api.example.com/orders"
```

**问题**: 5个 header (应为3个)，且 `Authorization` 重复3次。

### Root Cause Analysis

问题出在 `generatePureCurl` 函数中，header 被添加了两次：

1. **第一次**: 在处理手动添加的 headers 时，直接遍历 `req.headers` 数组
2. **第二次**: 在处理认证时（bearer/auth），又添加了 `Authorization` header

代码逻辑：
```typescript
// Headers - 手动添加的 headers
if (req.headers) {
  req.headers.forEach((h) => {
    parts.push(`-H "${h.key}: ${h.value}"`)
  })
}

// Auth - bearer - 再次添加 Authorization
if (req.auth.authType === "bearer") {
  parts.push(`-H "Authorization: Bearer ${req.auth.token}"`)
}
```

如果用户在 UI 中手动添加了 `Authorization` header，同时又设置了 Bearer Token 认证，就会导致重复。

### Solution

使用 `Map` 数据结构进行去重处理：

1. 首先收集所有手动添加的 headers 到 `headerMap`
2. 然后根据认证类型添加认证相关的 header（如果 key 不存在）
3. 最后统一输出所有唯一的 headers

## Issue 2: 缺少 Method

### 原始输入
```bash
curl -H "Authorization: Bearer token123" \
  -H "X-Request-ID: 12345" \
  -H "Accept: application/json" \
  "https://api.example.com/orders"
```

### 错误输出
```bash
curl \
  -H "Authorization: Bearer token123" \
  -H "X-Request-ID: 12345" \
  -H "Accept: application/json" \
  "https://api.example.com/orders"
```

**问题**: 缺少 `-X GET`，因为默认 GET 被省略了。

### Root Cause Analysis

原代码：
```typescript
// Method
if (req.method !== "GET") {
  parts.push(`-X ${req.method}`)
}
```

为了保持一致性，所有方法都应该显式输出。

### Solution

始终输出 `-X` 参数：
```typescript
// Method - always include -X for consistency
parts.push(`-X ${req.method}`)
```

## Files Modified

- `packages/hoppscotch-common/src/helpers/new-codegen/index.ts`

## Resolution

1. 重复的 header 会被去重
2. 所有请求方法都会显式输出 `-X`
