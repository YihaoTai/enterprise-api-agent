<template>
  <div class="body">
    <MockHeader
      :total="rules.length"
      :enabled="enabledCount"
      :disabled="disabledCount"
    />

    <div class="container">
      <!-- 操作栏 -->
      <div class="actions-bar">
        <button
          class="btn-add"
          @click="showForm = true"
        >
          <span class="icon">+</span>
          添加规则
        </button>
        <button
          v-if="rules.length > 0"
          class="btn-clear"
          @click="clearAllRules"
        >
          清空全部
        </button>
      </div>

      <!-- 规则列表 -->
      <div class="rules-section">
        <div class="rules-header">
          <h2>已添加规则</h2>
          <span class="rules-count">{{ rules.length }} 条</span>
        </div>
        <div class="search-bar">
          <el-input
            v-model="searchText"
            placeholder="搜索备注或 URL"
            clearable
            size="small"
          >
            <template #prefix><span class="search-icon">🔍</span></template>
          </el-input>
        </div>

        <div id="rules">
          <!-- 空状态 -->
          <div
            v-if="rules.length === 0"
            class="empty-state"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
              />
              <path d="M9 9h6M9 15h6" />
            </svg>
            <p>暂无 Mock 规则</p>
            <span class="empty-hint">点击上方按钮添加你的第一个规则</span>
          </div>
          <div
            v-else-if="searchText && filteredCount === 0"
            class="empty-state"
          >
            <p>查询结果为空</p>
            <span class="empty-hint">请更换关键词或清空搜索</span>
          </div>

          <!-- 规则列表 -->
          <div
            v-for="(rule, index) in rules"
            v-show="matches(rule)"
            :key="index"
            :class="['rule-item', { disabled: !rule.enabled }]"
          >
            <div
              v-if="rule.remark"
              class="remark"
            >
              <span class="remark-value">{{ rule.remark }} </span>
            </div>
            <div class="rule-header">
              <div class="rule-url">
                <span :class="['method-badge', `method-${(rule.method || 'ALL').toLowerCase()}`]">
                  {{ rule.method || 'ALL' }}
                </span>
                <span :class="['match-mode-badge', `match-mode-${rule.matchMode || 'contains'}`]">
                  {{ matchModeText[rule.matchMode] || '包含' }}
                </span>
                <span
                  :class="[
                    'status-badge',
                    (rule.status || 200) >= 500
                      ? 'status-5xx'
                      : (rule.status || 200) >= 400
                        ? 'status-4xx'
                        : 'status-2xx'
                  ]"
                >
                  {{ rule.status || 200 }}
                </span>
                <span
                  v-if="(rule.delayMs || 0) > 0"
                  class="delay-badge"
                >
                  {{ rule.delayMs }}ms
                </span>
                <span class="url-text">{{ rule.url }}</span>
              </div>
              <div class="rule-actions">
                <el-switch
                  v-model="rule.enabled"
                  size="small"
                  @change="toggleRule(index)"
                />
                <el-dropdown
                  trigger="click"
                  :teleported="false"
                  @command="(cmd) => (cmd === 'edit' ? editRule(index) : deleteRule(index))"
                >
                  <span
                    class="btn-icon more"
                    title="更多"
                    >···</span
                  >
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        class="menu-edit"
                        command="edit"
                        >编辑</el-dropdown-item
                      >
                      <el-dropdown-item
                        class="menu-delete"
                        command="delete"
                        >删除</el-dropdown-item
                      >
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>

            <!-- Mock 数据组件 -->
            <div class="rule-data-wrapper">
              <div
                class="mock-header"
                @click="toggleDataExpand(index)"
              >
                <span class="mock-title">Mock 响应</span>
                <span class="mock-toggle">{{ expandedRules.has(index) ? '收起' : '展开' }}</span>
              </div>
              <div
                v-if="expandedRules.has(index)"
                class="mock-body"
              >
                <JsonTreeEditor v-model="rule.data" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 规则表单弹窗 -->
    <RuleForm
      v-if="showForm"
      :edit-rule="editingRule"
      :is-edit="isEditing"
      @close="closeForm"
      @submit="handleSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import MockHeader from './components/MockHeader.vue'
import RuleForm from './components/RuleForm.vue'
import JsonTreeEditor from './components/JsonTreeEditor.vue'
import { Rule } from '@/types/rule'

const rules = ref<Rule[]>([])
const showForm = ref(false)
const isEditing = ref(false)
const editingIndex = ref(-1)
const editingRule = ref<Rule | undefined>()

const expandedRules = reactive(new Set<number>())

const matchModeText = {
  contains: '包含',
  exact: '完整',
  regex: '正则'
}

const searchText = ref('')

function matches(rule: Rule): boolean {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return true
  return (rule.url || '').toLowerCase().includes(q) || (rule.remark || '').toLowerCase().includes(q)
}

const filteredCount = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return rules.value.length
  let count = 0
  for (const r of rules.value) {
    if ((r.url || '').toLowerCase().includes(q) || (r.remark || '').toLowerCase().includes(q))
      count++
  }
  return count
})

// 计算启用的规则数量
const enabledCount = computed(() => {
  return rules.value.filter((rule) => rule.enabled).length
})

// 计算禁用的规则数量
const disabledCount = computed(() => {
  return rules.value.filter((rule) => !rule.enabled).length
})

// 关闭表单
const closeForm = () => {
  showForm.value = false
  isEditing.value = false
  editingIndex.value = -1
  editingRule.value = undefined
}

// 提交表单
const handleSubmit = (rule: Rule) => {
  if (isEditing.value && editingIndex.value >= 0) {
    rules.value[editingIndex.value] = rule
    ElMessage.success('修改成功')
  } else {
    rules.value.push(rule)
    ElMessage.success('添加成功')
  }
  saveRules()
  closeForm()
}

// 编辑规则
const editRule = (index: number) => {
  isEditing.value = true
  editingIndex.value = index
  editingRule.value = { ...rules.value[index] }
  showForm.value = true
}

// 清空全部规则（使用 Element Plus 确认弹窗 + 成功提示）
const clearAllRules = async () => {
  try {
    await ElMessageBox.confirm('确定清空所有规则？', '提示', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消'
    })
    rules.value = []
    saveRules()
    ElMessage.success('已清空')
  } catch (_) {}
}

// 切换规则启用状态
const toggleRule = (index: number) => {
  saveRules()
  const status = rules.value[index].enabled ? '已启用' : '已禁用'
  ElMessage.success(status)
}

// 删除规则（使用 Element Plus 确认弹窗 + 成功提示）
const deleteRule = async (index: number) => {
  try {
    await ElMessageBox.confirm('确定删除此规则？', '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    rules.value.splice(index, 1)
    saveRules()
    expandedRules.delete(index)
    ElMessage.success('已删除')
  } catch (_) {}
}

// 切换数据展开/收起
const toggleDataExpand = (index: number) => {
  if (expandedRules.has(index)) {
    expandedRules.delete(index)
  } else {
    expandedRules.add(index)
  }
}

// 保存规则到 storage
const saveRules = () => {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ mockRules: rules.value })
  }
}

// 监听规则变更，实时持久化（树节点编辑后立即生效）
watch(
  rules,
  () => {
    saveRules()
  },
  { deep: true }
)

// 页面加载时恢复数据
onMounted(() => {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['mockRules'], (result) => {
      const raw = result.mockRules
      const mockRulesArray = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object'
          ? Object.values(raw)
          : []

      rules.value = mockRulesArray.map((rule: any) => ({
        url: rule.url || '',
        method: rule.method || 'ALL',
        matchMode: rule.matchMode || 'contains',
        data: rule.data || '',
        enabled: rule.enabled !== false,
        remark: rule.remark || '',
        status: typeof rule.status === 'number' ? rule.status : 200,
        delayMs: typeof rule.delayMs === 'number' ? rule.delayMs : 0
      }))
    })
  }
})
</script>

<style scoped lang="less">
@primary: #6b7cff;
@primary2: #8b9aff;
@border: #e8e8e8;
@bg: #fafafa;
@muted: #8e8e93;
@text: #1d1d1f;
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.body {
  width: 100%;
  background: #fafafa;
  color: #1d1d1f;
  font-size: 13px;
  min-height: 100vh;
}

.container {
  padding: 0 14px 14px;
}

/* 操作栏 */
.actions-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  margin: 16px 0;
}

.btn-add {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  background: linear-gradient(135deg, #6b7cff 0%, #8b9aff 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add .icon {
  font-size: 18px;
  font-weight: 400;
}

.btn-add:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(107, 124, 255, 0.3);
}

.btn-add:active {
  transform: translateY(0);
}

.btn-clear {
  padding: 12px 16px;
  background: #fee2e2;
  color: #991b1b;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear:hover {
  background: #fecaca;
}

/* 规则列表区域 */
.rules-section {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 14px;
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.rules-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
}

.rules-count {
  font-size: 11px;
  color: #8e8e93;
  background: #f5f5f7;
  padding: 3px 10px;
  border-radius: 10px;
}

.search-bar {
  margin: 8px 0;
  :deep(.el-input) {
    --el-input-height: 34px;
  }
  :deep(.el-input__inner) {
    font-size: 12px;
    line-height: 34px;
  }
  :deep(.el-input__prefix) {
    left: 8px;
    height: 34px;
    display: flex;
    align-items: center;
  }
  :deep(.search-icon) {
    margin-right: 8px;
    display: inline-flex;
  }
}

#rules {
  max-height: 400px;
  overflow: visible;
}

.rule-item {
  background: #f9fafb;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  transition: all 0.2s;
}

.rule-item:last-child {
  margin-bottom: 0;
}

.rule-item.disabled {
  opacity: 0.6;
}

.rule-item:hover {
  border-color: #6b7cff;
  box-shadow: 0 2px 8px rgba(107, 124, 255, 0.1);
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  .rule-url {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: @text;
    flex: 1;
    min-width: 0;
    .url-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
  }
  .rule-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    :deep(.el-dropdown-menu__item.menu-edit) {
      color: #3b82f6;
    }
    :deep(.el-dropdown-menu__item.menu-edit:hover) {
      background: rgba(59, 130, 246, 0.08);
    }
    :deep(.el-dropdown-menu__item.menu-delete) {
      color: #ef4444;
    }
    :deep(.el-dropdown-menu__item.menu-delete:hover) {
      background: rgba(239, 68, 68, 0.08);
    }
  }
}
.remark {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;

  .remark-value {
    color: @muted;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 600;
    color: #1d1d1f;
  }
}

.btn-icon {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  transition: all 0.2s;
  border-radius: 4px;
  &:hover {
    opacity: 1;
    background: rgba(107, 124, 255, 0.1);
  }
}

.method-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.method-all {
  background: #e0e7ff;
  color: #4338ca;
}

.method-get {
  background: #d1fae5;
  color: #065f46;
}

.method-post {
  background: #fef3c7;
  color: #92400e;
}

.method-put {
  background: #dbeafe;
  color: #1e40af;
}

.method-delete {
  background: #fee2e2;
  color: #991b1b;
}

.match-mode-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
}

.match-mode-contains {
  background: #f3f4f6;
  color: #6b7280;
}

.match-mode-exact {
  background: #e0e7ff;
  color: #4338ca;
}

.match-mode-regex {
  background: #e5e7eb;
  color: #374151;
}

.status-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}
.status-2xx {
  background: #d1fae5;
  color: #065f46;
}
.status-4xx {
  background: #fef3c7;
  color: #92400e;
}
.status-5xx {
  background: #fee2e2;
  color: #991b1b;
}
.delay-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  color: #6b7280;
  background: #f3f4f6;
  flex-shrink: 0;
}

.rule-data-wrapper {
  position: relative;
  .mock-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    color: @muted;
    cursor: pointer;
    &:hover {
      color: @text;
    }
  }
  .mock-title {
    font-weight: 500;
  }
  .mock-toggle {
    font-size: 11px;
  }
  .mock-body {
    margin-top: 6px;
  }
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 50px 20px;
  color: #8e8e93;
}

.empty-state svg {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  opacity: 0.3;
}

.empty-state p {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
}

.empty-hint {
  font-size: 12px;
  color: #b0b0b0;
}
</style>
