#!/bin/bash
# AI Mock ID 字段测试用例

echo "=== AI Mock ID 字段测试 ==="
echo ""

echo "1. user_id (用户ID)"
for i in 1 2 3; do
  result=$(curl -s -X POST http://localhost:3002/api/mock/generate \
    -H 'Content-Type: application/json' \
    -d '{"jsonExample":"{\"user_id\":\"user001\"}"}' | jq -r '.data.user_id')
  echo "  第${i}次: $result"
done

echo ""
echo "2. admin_id (管理员ID)"
for i in 1 2 3; do
  result=$(curl -s -X POST http://localhost:3002/api/mock/generate \
    -H 'Content-Type: application/json' \
    -d '{"jsonExample":"{\"admin_id\":\"admin001\"}"}' | jq -r '.data.admin_id')
  echo "  第${i}次: $result"
done

echo ""
echo "3. item_id (物品ID)"
result=$(curl -s -X POST http://localhost:3002/api/mock/generate \
  -H 'Content-Type: application/json' \
  -d '{"jsonExample":"{\"item_id\":\"item_001\"}"}' | jq -r '.data.item_id')
echo "  结果: $result"

echo ""
echo "4. product_id (商品ID)"
for i in 1 2 3; do
  result=$(curl -s -X POST http://localhost:3002/api/mock/generate \
    -H 'Content-Type: application/json' \
    -d '{"jsonExample":"{\"product_id\":\"prod001\"}"}' | jq -r '.data.product_id')
  echo "  第${i}次: $result"
done

echo ""
echo "5. category_id (分类ID)"
for i in 1 2 3; do
  result=$(curl -s -X POST http://localhost:3002/api/mock/generate \
    -H 'Content-Type: application/json' \
    -d '{"jsonExample":"{\"category_id\":\"cat001\"}"}' | jq -r '.data.category_id')
  echo "  第${i}次: $result"
done

echo ""
echo "6. customer_id (客户ID)"
for i in 1 2 3; do
  result=$(curl -s -X POST http://localhost:3002/api/mock/generate \
    -H 'Content-Type: application/json' \
    -d '{"jsonExample":"{\"customer_id\":\"cust001\"}"}' | jq -r '.data.customer_id')
  echo "  第${i}次: $result"
done

echo ""
echo "7. payment_id (支付ID)"
for i in 1 2 3; do
  result=$(curl -s -X POST http://localhost:3002/api/mock/generate \
    -H 'Content-Type: application/json' \
    -d '{"jsonExample":"{\"payment_id\":\"pay001\"}"}' | jq -r '.data.payment_id')
  echo "  第${i}次: $result"
done

echo ""
echo "8. uuid (标准UUID)"
for i in 1 2 3; do
  result=$(curl -s -X POST http://localhost:3002/api/mock/generate \
    -H 'Content-Type: application/json' \
    -d '{"jsonExample":"{\"uuid\":\"550e8400-e29b-41d4-a716-446655440000\"}"}' | jq -r '.data.uuid')
  echo "  第${i}次: $result"
done

echo ""
echo "9. 复合测试"
result=$(curl -s -X POST http://localhost:3002/api/mock/generate \
  -H 'Content-Type: application/json' \
  -d '{"jsonExample":"{\"user_id\":\"user001\",\"product_id\":\"prod001\",\"name\":\"张三\"}"}' | jq '.data')
echo "$result"

echo ""
echo "=== 测试完成 ==="