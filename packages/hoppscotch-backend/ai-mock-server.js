/**
 * AI Mock Server - DeepSeek 版本
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// DeepSeek 配置 - 从 localStorage 获取，用户单独设置
let deepseekApiKey = '';
let deepseekModel = 'deepseek-chat';

// 存储上次生成结果，用于排除
const lastResults = new Map();

// 生成随机候选的函数
function getRandomItem(arr, exclude) {
  const available = arr.filter(x => x !== exclude);
  return available[Math.floor(Math.random() * available.length)];
}

// 本地随机数据映射
const randomData = {
  name: ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '刘一', '陈二', '林三', '黄四'],
  product_name: ['iPhone 15 Pro', '小米14 Ultra', '华为Mate 60 Pro', '三星Galaxy S24 Ultra', 'OPPO Find X7 Pro', 'vivo X100 Pro', '一加12', '荣耀Magic 6 Pro'],
  product: ['iPhone 15', '小米14', '华为Mate 60', '三星S24', 'OPPO Find X7'],
  city: ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安', '苏州', '重庆', '天津', '青岛', '长沙', '郑州'],
  province: ['北京', '上海', '广东', '浙江', '江苏', '四川', '湖北', '湖南', '山东', '河南', '陕西', '福建'],
  district: ['朝阳区', '海淀区', '浦东新区', '天河区', '南山区', '西湖区', '江干区', '锦江区', '武侯区', '江汉区'],
  address: ['朝阳区建国路88号', '海淀区中关村大街1号', '浦东新区世纪大道100号', '天河区天河路385号'],
  username: ['user001', 'user002', 'user003', 'admin001', 'guestuser', 'test_user', 'demo123', 'john_doe', 'alice_wang', 'bob_li'],
  email: ['test@example.com', 'user@company.com', 'admin@system.com', 'john@gmail.com', 'alice@outlook.com'],
  phone: ['13812345678', '13912345678', '15812345678', '18812345678', '13612345678'],
  mobile: ['13812345678', '13912345678', '15812345678', '18812345678', '13612345678'],
  tel: ['010-12345678', '021-12345678', '020-12345678', '0755-12345678'],
  telephone: ['010-12345678', '021-12345678', '020-12345678', '0755-12345678'],
  password: ['Pass1234', 'Test@123', 'Admin#123', 'User!456', 'Demo$789'],
  gender: ['male', 'female', 'other', 'unknown'],
  sex: ['male', 'female', 'other'],
  birth: ['1990-01-01', '1995-06-15', '2000-12-25', '1988-03-10', '1992-09-05'],
  birthday: ['1990-01-01', '1995-06-15', '2000-12-25', '1988-03-10', '1992-09-05'],
  bio: ['热爱技术，喜欢编程', '前端开发工程师', '后端架构师', '全栈开发者', '产品经理'],
  description: ['这是一个描述', '用户详细信息', '产品说明文字', '内容摘要', '详细描述'],
  desc: ['这是一个描述', '用户详细信息', '产品说明文字', '内容摘要', '详细描述'],
  content: ['内容内容', '文章正文', '评论内容', '消息正文', '描述文本'],
  title: ['标题一', '标题二', '文章标题', '产品名称', '主题标题'],
  headline: ['标题一', '标题二', '文章标题', '产品名称', '主题标题'],
  summary: ['摘要一', '摘要二', '内容摘要', '简短描述', '概述文本'],
  avatar: ['https://example.com/avatar/1.jpg', 'https://example.com/avatar/2.jpg', 'https://example.com/avatar/3.jpg'],
  image: ['https://example.com/image/1.jpg', 'https://example.com/image/2.jpg', 'https://example.com/image/3.jpg'],
  img: ['https://example.com/img/1.jpg', 'https://example.com/img/2.jpg', 'https://example.com/img/3.jpg'],
  photo: ['https://example.com/photo/1.jpg', 'https://example.com/photo/2.jpg', 'https://example.com/photo/3.jpg'],
  url: ['https://example.com', 'https://test.com', 'https://demo.com'],
  link: ['https://example.com', 'https://test.com', 'https://demo.com'],
  website: ['https://example.com', 'https://test.com', 'https://demo.com'],
  status: ['active', 'inactive', 'pending', 'deleted', 'blocked', 'archived'],
  type: ['standard', 'premium', 'basic', 'pro'],
  role: ['admin', 'user', 'guest', 'vip', 'premium', 'editor', 'viewer'],
  created_at: ['2024-01-01 10:00:00', '2024-02-15 14:30:00', '2024-03-20 09:15:00', '2024-04-10 16:45:00'],
  updated_at: ['2024-01-05 11:00:00', '2024-02-20 15:30:00', '2024-03-25 10:15:00', '2024-04-15 17:45:00'],
  deleted_at: ['2024-01-10 12:00:00', '2024-02-25 16:30:00', '2024-03-30 11:15:00'],
  timestamp: [1714060800000, 1714150800000, 1714240800000, 1714330800000],
  time: ['10:00:00', '14:30:00', '09:15:00', '16:45:00'],
  date: ['2024-01-01', '2024-02-15', '2024-03-20', '2024-04-10'],
  datetime: ['2024-01-01 10:00:00', '2024-02-15 14:30:00', '2024-03-20 09:15:00'],
  // Java 时间类型
  localdate: ['2025-01-15', '2025-02-20', '2025-03-25', '2025-04-10'],
  localtime: ['09:22:10', '14:30:45', '18:15:30', '21:45:00'],
  localdatetime: ['2025-01-15T09:22:10', '2025-02-20T14:30:45', '2025-03-25T18:15:30'],
  instant: ['2025-01-15T09:22:10Z', '2025-02-20T14:30:45Z', '2025-03-25T18:15:30Z'],
  zoneddatetime: ['2025-01-15T09:22:10+08:00', '2025-02-20T14:30:45+08:00', '2025-03-25T18:15:30+08:00'],
  offsetdatetime: ['2025-01-15T09:22:10+08:00', '2025-02-20T14:30:45+08:00', '2025-03-25T18:15:30+08:00'],
  long: [1736931730000, 1736932730000, 1736933730000, 1736934730000],
  // 常见 Java 字段名映射
  createdate: ['2025-01-15', '2025-02-20', '2025-03-25'],
  createtime: ['2025-01-15T09:22:10Z', '2025-02-20T14:30:45Z'],
  updatedate: ['2025-01-15', '2025-02-20', '2025-03-25'],
  updatetime: ['2025-01-15T09:22:10Z', '2025-02-20T14:30:45Z'],
  birthdate: ['1990-01-01', '1995-06-15', '2000-12-25'],
  birthday: ['1990-01-01', '1995-06-15', '2000-12-25'],
  id: ['1001', '1002', '1003', '1004', '1005'],
  uuid: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
  age: [18, 20, 25, 30, 35, 40],
  count: [1, 2, 3, 5, 10, 20],
  number: [1, 2, 3, 5, 10, 20],
  num: [1, 2, 3, 5, 10, 20],
  total: [100, 200, 500, 1000, 2000],
  score: [60, 70, 80, 90, 100],
  rating: [1, 2, 3, 4, 5],
  price: [99.0, 199.0, 299.0, 499.0, 999.0],
  amount: [100, 200, 500, 1000, 2000],
  cost: [50, 100, 150, 200, 250],
  discount: [0.1, 0.2, 0.3, 0.5, 0.8],
  address: ['朝阳区建国路88号', '海淀区中关村大街1号', '浦东新区世纪大道100号'],
  country: ['中国', '美国', '日本', '韩国', '英国'],
  state: ['北京', '上海', '广东', '浙江', '江苏'],
  zipcode: ['100000', '200000', '310000', '510000'],
  postal_code: ['100000', '200000', '310000', '510000'],
};

function getRandomByField(fieldName) {
  const lower = fieldName.toLowerCase();
  for (const [key, values] of Object.entries(randomData)) {
    if (lower.includes(key)) {
      console.log(`[DEBUG] getRandomByField: matched field "${fieldName}" with key "${key}"`);
      return values[Math.floor(Math.random() * values.length)];
    }
  }
  console.log(`[DEBUG] getRandomByField: no match for field "${fieldName}"`);
  return null;
}

// 清理 LLM 返回的 schema 格式残留
// 例如：{ "name": "张三", "city": { "type": "string" } } -> { "name": "张三", "city": "随机城市" }
function cleanSchemaFormat(obj, fieldName = '') {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanSchemaFormat(item));
  }

  if (obj && typeof obj === 'object') {
    // 检测是否是 schema 格式：只有一个 "type" 属性，值是 string
    const keys = Object.keys(obj);
    if (keys.length === 1 && 'type' in obj && typeof obj.type === 'string') {
      // 这是残留的 schema 格式，根据字段名生成随机值
      const randomVal = getRandomByField(fieldName) || getSemanticString(fieldName);
      console.log(`[DEBUG] cleanSchemaFormat: field "${fieldName}" -> "${randomVal}"`);
      return randomVal;
    }

    // 递归处理对象属性
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = cleanSchemaFormat(value, key);
    }
    return result;
  }

  return obj;
}

// 检测 ID 字段的格式模式（字母数字交替、纯数字、纯字母等）
function detectIdPattern(val) {
  if (typeof val !== 'string') return null;
  // 例如：user001, order001, abc123, A1B2C3
  if (/^[a-zA-Z]+\d+$/.test(val)) return 'prefix_number';  // user001
  if (/^\d+[a-zA-Z]+$/.test(val)) return 'number_suffix';  // 001user
  if (/^[a-zA-Z]+[a-zA-Z0-9]+[a-zA-Z0-9]+$/.test(val) && /[a-zA-Z]/.test(val) && /\d/.test(val)) return 'alphanumeric';  // abc123, user001
  return null;
}

// 生成符合业务逻辑的 ID
function generateId(fieldName, exampleVal) {
  const pattern = detectIdPattern(exampleVal);
  if (!pattern) return null;

  const prefix = fieldName.replace(/_id$/, '').substring(0, Math.min(fieldName.length, 6));
  const num = String(Math.floor(Math.random() * 9000) + 1000);

  switch (pattern) {
    case 'prefix_number': // user001
      return prefix + num;
    case 'number_suffix': // 001user
      return num + prefix;
    case 'alphanumeric': // user001 或 abc123
      // 保持字母数字交替格式
      let result = '';
      for (let i = 0; i < Math.max(prefix.length, 4); i++) {
        if (i < prefix.length && i % 2 === 0) {
          result += prefix[i].toLowerCase();
        } else if (i < prefix.length) {
          result += num[i % num.length];
        } else {
          result += num[i % num.length];
        }
      }
      return result;
    default:
      return prefix + num;
  }
}

// 生成标准 UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 生成随机 Mock 数据
function generateMockFromSample(sample) {
  const result = {};

  // 检测并清理 schema 格式的输入
  // 例如：{"name":{"type":"string"},"city":{"type":"string"}} 需要转换为真正的 schema
  const isSchemaFormat = Object.values(sample).some(v =>
    v && typeof v === 'object' && v.type && typeof v.type === 'string' && Object.keys(v).length <= 2
  );

  for (const [key, val] of Object.entries(sample)) {
    if (key === '_salt') continue;

    // 清理 schema 格式的残留值
    // 例如：{ "type": "string" } 转换为随机字符串
    if (val && typeof val === 'object' && val.type && typeof val.type === 'string' && Object.keys(val).length === 1) {
      // 这是残留的 schema 格式，根据字段名生成随机值
      const randomVal = getRandomByField(key) || getSemanticString(key);
      result[key] = randomVal;
      continue;
    }

    // 跳过 _salt
    if (val && typeof val === 'object' && val._salt !== undefined) continue;

    // 优先检查 ID 字段，保持字母数字交替格式
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('_id') && typeof val === 'string') {
      const generatedId = generateId(key, val);
      if (generatedId) {
        result[key] = generatedId;
        continue;
      }
    }

    // 如果是 schema 格式的嵌套对象，递归处理
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nestedResult = generateMockFromSample(val);
      result[key] = nestedResult;
      continue;
    }

    // 如果是数组且第一个元素是对象，递归处理
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      result[key] = [generateMockFromSample(val[0])];
      continue;
    }

    // 根据字段名获取随机值
    const randomVal = getRandomByField(key);
    if (randomVal !== null) {
      result[key] = randomVal;
    } else if (typeof val === 'number') {
      result[key] = Math.floor(Math.random() * 9000) + 100;
    } else if (typeof val === 'boolean') {
      result[key] = Math.random() > 0.5;
    } else if (typeof val === 'string') {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('email')) {
        result[key] = `user${Math.floor(Math.random() * 1000)}@example.com`;
      } else if (lowerKey.includes('url') || lowerKey.includes('avatar') || lowerKey.includes('image')) {
        result[key] = `https://example.com/${key}/${Math.random().toString(36).substring(2, 8)}.jpg`;
      } else if (lowerKey.includes('price') || lowerKey.includes('amount')) {
        result[key] = (Math.random() * 9000 + 100).toFixed(2);
      } else if (lowerKey === 'id' || lowerKey === 'uuid') {
        result[key] = Math.floor(Math.random() * 10000);
      } else {
        // 尝试根据字段名语义生成更合理的随机字符串
        result[key] = getSemanticString(key);
      }
    } else {
      result[key] = val;
    }
  }
  return result;
}

// 根据字段名语义生成合理的字符串
function getSemanticString(fieldName) {
  const lower = fieldName.toLowerCase();

  // 常见中文词组
  const words = ['测试', '示例', '数据', '内容', '描述', '标题', '名称', '信息', '文本', '内容'];
  const word = words[Math.floor(Math.random() * words.length)];

  // 根据字段名选择合适的字符串
  if (lower.includes('title') || lower.includes('标题')) {
    return `标题${Math.floor(Math.random() * 1000)}`;
  }
  if (lower.includes('content') || lower.includes('内容') || lower.includes('text')) {
    return `这是${word}${Math.floor(Math.random() * 100)}`;
  }
  if (lower.includes('desc') || lower.includes('描述') || lower.includes('summary')) {
    return `${word}描述${Math.floor(Math.random() * 100)}`;
  }
  if (lower.includes('name') || lower.includes('名') || lower.includes('标题')) {
    const surnames = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十'];
    return surnames[Math.floor(Math.random() * surnames.length)];
  }
  if (lower.includes('code') || lower.includes('编码')) {
    return `CODE${Math.floor(Math.random() * 10000)}`;
  }
  if (lower.includes('no') || lower.includes('编号')) {
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }
  if (lower.includes('key')) {
    return `key_${Math.random().toString(36).substring(2, 10)}`;
  }
  if (lower.includes('token')) {
    return `token_${Math.random().toString(36).substring(2, 16)}`;
  }
  if (lower.includes('remark') || lower.includes('备注')) {
    return `备注${Math.floor(Math.random() * 100)}`;
  }

  // 默认返回更有意义的中文随机字符串
  return `${word}_${Math.floor(Math.random() * 1000)}`;
}

app.get('/test', (req, res) => res.json({ status: 'ok', time: Date.now() }));

// API 端点：设置 DeepSeek API Key
app.post('/api/mock/set-key', (req, res) => {
  const { apiKey, model } = req.body;
  if (apiKey) {
    deepseekApiKey = apiKey;
  }
  if (model) {
    deepseekModel = model;
  }
  res.json({ success: true });
});

// API 端点：获取当前配置状态
app.get('/api/mock/status', (req, res) => {
  res.json({
    success: true,
    hasKey: !!deepseekApiKey,
    model: deepseekModel
  });
});

// 生成 Mock 数据的端点
app.post('/api/mock/generate', async (req, res) => {
  console.log('Received request:', JSON.stringify(req.body).substring(0, 200));
  try {
    let { jsonExample, apiKey, temperature = 0.9, k = 0.5 } = req.body;

    // 限制 k 值范围在 0-1 之间
    k = Math.max(0, Math.min(1, parseFloat(k) || 0.5));

    // 优先使用请求中的 API Key，否则使用服务器配置的
    const effectiveApiKey = apiKey || deepseekApiKey;

    if (!jsonExample) {
      return res.status(400).json({ success: false, error: 'jsonExample required' });
    }

    if (!effectiveApiKey) {
      return res.status(400).json({ success: false, error: 'DeepSeek API Key required' });
    }

    // 解析 JSON Schema
    const sample = JSON.parse(jsonExample);

    // 分析字段结构
    const analyzeStructure = (obj, path = '') => {
      const fields = [];

      if (obj === null || obj === undefined) {
        return fields;
      }

      if (Array.isArray(obj)) {
        if (obj.length > 0) {
          fields.push({ path: path || 'array', type: 'array', itemType: analyzeStructure(obj[0], path + '[0]') });
        } else {
          fields.push({ path: path || 'array', type: 'empty_array' });
        }
        return fields;
      }

      if (typeof obj === 'object') {
        for (const [key, val] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          if (val === null) {
            fields.push({ path: currentPath, type: 'null', key });
          } else if (typeof val === 'string') {
            // 检测语言类型
            let langType = 'string';
            if (/^[\u4e00-\u9fa5]+$/.test(val)) langType = 'chinese';
            else if (/^[a-zA-Z]+$/.test(val)) langType = 'english';
            else if (/^[0-9]+(\.[0-9]+)?$/.test(val)) langType = 'number_string';
            else if (/^\d{4}-\d{2}-\d{2}/.test(val)) langType = 'date_string';
            else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val)) langType = 'email';
            else if (/^https?:\/\//.test(val)) langType = 'url';
            fields.push({ path: currentPath, type: 'string', langType, key, value: val });
          } else if (typeof val === 'number') {
            fields.push({ path: currentPath, type: Number.isInteger(val) ? 'integer' : 'float', key, value: val });
          } else if (typeof val === 'boolean') {
            fields.push({ path: currentPath, type: 'boolean', key, value: val });
          } else if (Array.isArray(val)) {
            const itemType = val.length > 0 ? analyzeStructure(val[0], currentPath + '[0]') : 'empty';
            fields.push({ path: currentPath, type: 'array', itemType, key });
          } else if (typeof val === 'object') {
            fields.push({ path: currentPath, type: 'object', children: analyzeStructure(val, currentPath), key });
          } else {
            fields.push({ path: currentPath, type: 'unknown', key });
          }
        }
      }

      return fields;
    };

    const structure = analyzeStructure(sample);

    // 根据 k 值构建不同强度的结构提示
    // k=0: 忽略输入值，只根据字段名生成合理数据
    // k=1: 严格遵循输入值的类型和风格，保持一致性
    const buildStructureHint = (k, sample) => {
      if (k <= 0) {
        // k=0: 完全忽略输入示例值，只根据字段名语义生成合理数据
        const fieldNames = Object.keys(sample).join('、');
        return `
【核心规则】忽略示例值，根据字段名生成数据！

输入示例中的值（"123"、"a@b.com"等）只是占位符，必须完全忽略！
例如：
- 输入 "name":"123" → 输出 "name":"张三"（中文姓名）
- 输入 "email":"abc" → 输出 "email":"user@example.com"（邮箱格式）
- 输入 "age":999 → 输出 "age":25（合理年龄范围）

字段名 "${fieldNames}" 的语义：
- name/username → 中文姓名：张三、李四、王五
- email → 邮箱：user@example.com
- age/count/number → 数字：18-80
- isActive/enabled/flag → 布尔：true/false
- 其他字段 → 根据字段名语义生成合理值

【强制要求】
- 禁止输出与示例值相似的内容（如 "456" 跟随 "123"）
- 必须生成符合字段语义的真实业务数据`;
      }

      if (k >= 1) {
        // k=1: 严格遵循输入示例值的类型和风格，保持一致
        return `
【重要】严格遵循输入示例值！
- 如果示例是 "name":"123"，输出必须是类似 "name":"456" 的字符串/数字
- 如果示例是 "email":"abc"，输出必须保持相同的字符风格和长度
- 如果示例是 "age":123，输出必须是数字类型
- 保持示例值的类型、格式、风格一致，即使看起来不合理

【生成规则】
- 输出数据的类型必须与示例完全一致
- 字符串保持相同格式（如纯数字、纯字母等）
- 数字保持相同范围和精度
- 不要根据字段名语义生成"合理"的值`;
      }

      // k 在 0-1 之间：部分参考示例，部分根据语义
      const kPercent = Math.round(k * 100);
      return `
【部分参考】示例值参考程度: ${kPercent}%

当 k=0 时忽略示例值只根据字段名生成合理数据，k=1 时严格遵循示例值。当前设置为部分参考：
- 较低优先级的字段可以适当参考字段语义
- 较高优先级的字段应保持与示例值的一致性

【建议】
- 类型匹配：示例是数字就输出数字，示例是字符串就输出字符串
- 格式参考：示例的风格可以适当参考`;
    };

    const structureHint = buildStructureHint(k, sample);

    // 构建适合 DeepSeek 的 Prompt（参考克隆项目）
    const shape = '返回一个对象（不使用额外包裹层），仅包含你描述的业务数据';
    const prompt = `${shape}。只返回合法 JSON，不输出解释或代码块标记。字段尽量简短。\n\n根据以下 JSON Schema 生成真实的 Mock 数据：\n${jsonExample}${structureHint}\n\n要求：返回纯JSON对象，不要任何包裹层。`;

    // 调用 DeepSeek API
    try {
      const body = {
        model: deepseekModel,
        temperature: 0.2,
        stream: false,
        messages: [
          {
            role: 'system',
            content: '只返回合法 JSON，不输出思考过程，不输出解释，不输出代码块标记。'
          },
          { role: 'user', content: prompt }
        ]
      };

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveApiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const err = await response.json();
          errMsg = err?.error?.message || errMsg;
        } catch {}

        // 如果是认证错误，返回特定错误信息
        if (response.status === 401 || /invalid|unauthor|expired/i.test(errMsg)) {
          return res.status(401).json({ success: false, error: 'API Key 无效或已过期' });
        }
        if (response.status === 429 || response.status === 402 || /quota|insufficient|limit/i.test(errMsg)) {
          return res.status(429).json({ success: false, error: '额度不足或已达限制' });
        }

        throw new Error(errMsg);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';

      // 提取 JSON（处理可能的 markdown 包裹）
      const extractJson = (text) => {
        const m1 = text.match(/```json\s*([\s\S]*?)\s*```/i);
        if (m1) return m1[1].trim();
        const m2 = text.match(/```\s*([\s\S]*?)\s*```/);
        if (m2) return m2[1].trim();
        return text.trim();
      };

      const rawOnce = extractJson(content);
      try {
        let result = JSON.parse(rawOnce);
        delete result._salt;

        // 清理可能的 schema 格式残留
        result = cleanSchemaFormat(result);

        // 保存本次结果用于下次排除
        lastResults.set(jsonExample, result);
        return res.json({ success: true, data: result });
      } catch {
        // 如果解析失败，返回原始内容
        return res.json({ success: true, data: rawOnce });
      }
    } catch (llmError) {
      console.log('LLM failed, use local:', llmError.message);

      // 如果 LLM 调用失败，使用本地随机生成
      const result = generateMockFromSample(sample);
      delete result._salt;
      return res.json({ success: true, data: result });
    }
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(4000, '127.0.0.1', () => console.log('AI Mock:4000'));