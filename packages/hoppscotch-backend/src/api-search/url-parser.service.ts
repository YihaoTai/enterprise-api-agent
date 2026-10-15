/**
 * URL Semantic Parser Service
 * 将 URL 解析为语义描述
 */
import { Injectable, Logger } from '@nestjs/common';

export interface ParsedURL {
  path: string;
  method: string;
  resource: string;      // 资源名 如 "用户", "订单"
  action: string;        // 操作 如 "查询", "创建"
  params: string[];      // 参数名列表
  paramValues: string[]; // 参数值列表（ID类）
  description: string;   // 生成的语义描述
}

// 常见 API 路径到资源的映射
const PATH_RESOURCE_MAP: Record<string, string> = {
  // 用户相关
  'users': '用户',
  'user': '用户',
  'profile': '用户资料',
  'auth': '认证',
  'login': '登录',
  'register': '注册',
  'logout': '登出',

  // 订单相关
  'orders': '订单',
  'order': '订单',

  // 商品相关
  'products': '商品',
  'product': '商品',
  'items': '商品',
  'goods': '商品',

  // 支付相关
  'payments': '支付',
  'payment': '支付',
  'transactions': '交易',

  // 通用 CRUD
  'list': '列表',
  'detail': '详情',
  'info': '信息',
  'data': '数据',

  // 文件相关
  'files': '文件',
  'file': '文件',
  'upload': '上传',
  'download': '下载',

  // 通知相关
  'notifications': '通知',
  'notification': '通知',
  'messages': '消息',
  'message': '消息',
};

// HTTP 方法到操作的映射
const METHOD_ACTION_MAP: Record<string, string> = {
  'GET': '获取',
  'POST': '创建',
  'PUT': '更新',
  'PATCH': '更新',
  'DELETE': '删除',
};

// 参数名到中文的映射
const PARAM_KEY_MAP: Record<string, string> = {
  // ID 类
  'id': 'ID',
  'userId': '用户ID',
  'orderId': '订单ID',
  'productId': '商品ID',

  // 字段选择
  'fields': '字段',
  'field': '字段',
  'select': '选择',
  'include': '包含',

  // 常见字段
  'email': '邮箱',
  'phone': '电话',
  'mobile': '手机',
  'name': '名称',
  'username': '用户名',
  'password': '密码',
  'avatar': '头像',
  'address': '地址',
  'status': '状态',
  'price': '价格',
  'quantity': '数量',
  'count': '数量',
  'page': '页码',
  'limit': '限制',
  'size': '大小',
  'keyword': '关键词',
  'search': '搜索',
  'query': '查询',
  'filter': '过滤',
  'sort': '排序',

  // 业务相关
  'type': '类型',
  'category': '分类',
  'tag': '标签',
  'role': '角色',
  'level': '级别',

  // 时间
  'startDate': '开始日期',
  'endDate': '结束日期',
  'startTime': '开始时间',
  'endTime': '结束时间',
  'date': '日期',
  'time': '时间',

  // 用户相关
  'age': '年龄',
  'gender': '性别',
  'birthday': '生日',
  'bio': '简介',

  // 订单相关
  'amount': '金额',
  'currency': '货币',
  'shipping': '配送',
};

@Injectable()
export class UrlParserService {
  private readonly logger = new Logger(UrlParserService.name);

  /**
   * 解析 URL 为语义描述
   */
  parse(request: {
    endpoint: string;
    method: string;
    params?: Array<{ key: string; value: string; description?: string }>;
    name?: string;
  }): ParsedURL {
    const url = request.endpoint;
    const method = request.method.toUpperCase();
    const params = request.params || [];

    try {
      // 提取 URL 路径
      const urlObj = new URL(url.startsWith('http') ? url : `https://example.com${url}`);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);

      // 解析资源名
      const resource = this.parseResource(pathSegments);

      // 解析操作
      const action = this.parseAction(method, pathSegments);

      // 解析参数
      const { params: paramNames, paramValues } = this.parseParams(params);

      // 生成描述
      const description = this.generateDescription({
        resource,
        action,
        params: paramNames,
        paramValues,
      });

      return {
        path: urlObj.pathname,
        method,
        resource,
        action,
        params: paramNames,
        paramValues,
        description,
      };
    } catch (error: any) {
      this.logger.warn(`URL parse failed: ${error.message}`);
      return {
        path: url,
        method,
        resource: '',
        action: '',
        params: [],
        paramValues: [],
        description: request.name || '',
      };
    }
  }

  /**
   * 解析资源名
   */
  private parseResource(pathSegments: string[]): string {
    // 跳过版本号 (v1, v2, api 等)
    const meaningfulSegments = pathSegments.filter(
      (seg) => !/^v\d+$/i.test(seg) && seg.toLowerCase() !== 'api'
    );

    for (const segment of meaningfulSegments) {
      // 检查是否包含数字（可能是 ID）
      if (/^\d+$/.test(segment)) continue;

      // 检查是否有映射
      const lower = segment.toLowerCase();
      if (PATH_RESOURCE_MAP[lower]) {
        return PATH_RESOURCE_MAP[lower];
      }

      // 尝试复数形式
      if (PATH_RESOURCE_MAP[lower.slice(0, -1)]) {
        return PATH_RESOURCE_MAP[lower.slice(0, -1)];
      }

      // 直接返回原始segment（可能是有意义的英文）
      return segment;
    }

    return '';
  }

  /**
   * 解析操作
   */
  private parseAction(method: string, pathSegments: string[]): string {
    // 从方法获取基础操作
    const baseAction = METHOD_ACTION_MAP[method] || '操作';

    // 检查路径是否包含操作关键词
    const lastSegment = pathSegments[pathSegments.length - 1]?.toLowerCase() || '';

    if (lastSegment.includes('create') || lastSegment.includes('add')) {
      return '创建';
    }
    if (lastSegment.includes('update') || lastSegment.includes('edit')) {
      return '更新';
    }
    if (lastSegment.includes('delete') || lastSegment.includes('remove')) {
      return '删除';
    }
    if (lastSegment.includes('list') || lastSegment.includes('all')) {
      return '列表';
    }
    if (lastSegment.includes('detail') || lastSegment.includes('info')) {
      return '详情';
    }

    return baseAction;
  }

  /**
   * 解析参数
   * 支持的 params 格式：
   * - [{ key: string, value: string, active?: boolean, description?: string }]
   * - [{ key: string, value: string, description?: string }]
   */
  private parseParams(params: any[]) {
    const paramNames: string[] = [];
    const paramValues: string[] = [];

    if (!params || !Array.isArray(params)) {
      return { params: paramNames, paramValues };
    }

    for (const param of params) {
      // 检查 param 是否有效
      if (!param || !param.key) continue;

      // 检查是否启用 (有些格式有 active 字段，有些没有)
      if ('active' in param && param.active === false) continue;

      const key = param.key?.toLowerCase() || '';
      const value = param.value || '';

      // 获取参数的中文含义
      const chineseKey = PARAM_KEY_MAP[key] || param.key;

      // 区分 ID 类参数和字段类参数
      if (key.includes('id') || /^\d+$/.test(value)) {
        paramValues.push(value);
      } else {
        paramNames.push(chineseKey);
      }
    }

    return { params: paramNames, paramValues };
  }

  /**
   * 生成语义描述
   */
  private generateDescription(data: {
    resource: string;
    action: string;
    params: string[];
    paramValues: string[];
  }): string {
    const parts: string[] = [];

    // 操作 + 资源
    if (data.resource && data.action) {
      parts.push(`${data.action}${data.resource}`);
    } else if (data.resource) {
      parts.push(data.resource);
    }

    // 字段选择
    if (data.params.length > 0) {
      parts.push(`，返回${data.params.join('、')}`);
    }

    return parts.join('') || 'API 请求';
  }
}