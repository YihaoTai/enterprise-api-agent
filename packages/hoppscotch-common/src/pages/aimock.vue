<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 p-4 overflow-hidden">
      <h2 class="text-lg font-semibold mb-3 text-secondaryDark">
        {{ t("ai_mock.title") }}
      </h2>

      <!-- AI 生成 Tab -->
      <div class="h-full overflow-hidden">
        <!-- 左右布局：左侧输入，右侧结果 -->
        <div class="flex gap-3 h-full">
          <!-- 左侧：输入区域 -->
          <div class="flex-1 flex flex-col gap-3 overflow-y-auto">
            <!-- 输入模式切换（自然语言/JSON模板） -->
            <div class="rounded border border-dividerLight p-3 flex-shrink-0">
              <div class="flex gap-1 bg-primaryDark rounded p-1">
                <button
                  :class="[
                    'flex-1 px-3 py-1.5 text-sm font-medium rounded transition-colors',
                    aiInputMode === 'description'
                      ? 'bg-accent text-white'
                      : 'text-secondaryLight hover:text-secondaryDark',
                  ]"
                  @click="aiInputMode = 'description'"
                >
                  自然语言
                </button>
                <button
                  :class="[
                    'flex-1 px-3 py-1.5 text-sm font-medium rounded transition-colors',
                    aiInputMode === 'json'
                      ? 'bg-accent text-white'
                      : 'text-secondaryLight hover:text-secondaryDark',
                  ]"
                  @click="aiInputMode = 'json'"
                >
                  JSON 模板
                </button>
              </div>
            </div>

            <!-- 类型描述输入（自然语言模式） -->
            <div
              v-if="aiInputMode === 'description'"
              class="relative rounded border border-dividerLight flex flex-col overflow-hidden group"
            >
              <label
                class="text-sm font-semibold text-secondaryLight p-2 block border-b border-dividerLight flex-shrink-0"
              >
                {{ t("ai_mock.type_description") }}
              </label>
              <!-- 拖动调整高度把手 -->
              <div
                class="absolute left-0 right-0 top-0 h-2 cursor-row-resize hover:bg-accent/20 active:bg-accent/30 z-10 transition-colors"
                @mousedown="startAiInputResize"
              ></div>
              <textarea
                v-model="typePrompt"
                class="w-full text-xs font-mono text-secondaryDark bg-primaryLight p-2 rounded-none resize-none focus:outline-none focus:ring-1 focus:ring-accent overflow-y-auto"
                :style="{ height: `${aiInputHeight}px` }"
                :placeholder="t('ai_mock.type_placeholder')"
                spellcheck="false"
              />
            </div>

            <!-- JSON 模板输入（JSON 模式） -->
            <div
              v-else
              class="relative rounded border border-dividerLight flex flex-col overflow-hidden group"
            >
              <label
                class="text-sm font-semibold text-secondaryLight p-2 block border-b border-dividerLight flex-shrink-0"
              >
                JSON 模板
              </label>
              <!-- 拖动调整高度把手 -->
              <div
                class="absolute left-0 right-0 top-0 h-2 cursor-row-resize hover:bg-accent/20 active:bg-accent/30 z-10 transition-colors"
                @mousedown="startAiInputResize"
              ></div>
              <textarea
                v-model="jsonTemplate"
                class="w-full text-xs font-mono text-secondaryDark bg-primaryLight p-2 rounded-none resize-none focus:outline-none focus:ring-1 focus:ring-accent overflow-y-auto"
                :style="{ height: `${aiInputHeight}px` }"
                placeholder='粘贴 JSON 模板，例如：&#10;{&#10;  "name": "张三",&#10;  "age": 25&#10;}'
                spellcheck="false"
              />
              <p class="text-xs text-secondaryLight p-2 flex-shrink-0">
                粘贴 JSON 模板后，AI 将参照此结构生成相似但不同的 Mock 数据
              </p>
            </div>

            <!-- 生成按钮 -->
            <div class="flex justify-center flex-shrink-0">
              <HoppButtonPrimary
                :label="
                  isGenerating ? t('ai_mock.generating') : t('ai_mock.generate')
                "
                :disabled="
                  (aiInputMode === 'description'
                    ? !typePrompt.trim()
                    : !jsonTemplate.trim()) || isGenerating
                "
                @click="generateFromAI"
              />
            </div>

            <!-- 错误信息 -->
            <div
              v-if="errorMessage"
              class="rounded border border-red-500 bg-red-500/10 p-3 flex-shrink-0"
            >
              <p class="text-red-500 text-sm">{{ errorMessage }}</p>
            </div>
          </div>

          <!-- 右侧：结果区域（Mock Result + Field Types） -->
          <div class="flex-1 flex flex-col gap-3 overflow-hidden">
            <!-- Mock 结果 -->
            <div
              class="rounded border border-dividerLight p-3 flex flex-col overflow-hidden"
            >
              <div class="flex items-center justify-between mb-2 flex-shrink-0">
                <h3 class="font-semibold text-secondaryDark text-sm">
                  {{ t("ai_mock.mock_result") }}
                </h3>
                <div class="flex items-center">
                  <HoppButtonSecondary
                    v-tippy="{ theme: 'tooltip' }"
                    :title="t('action.fullscreen')"
                    :icon="IconMaximize2"
                    @click="showFullscreen = true"
                  />
                  <HoppButtonSecondary
                    v-tippy="{ theme: 'tooltip' }"
                    :title="t('action.copy')"
                    :icon="IconClipboard"
                    @click="copyAiGeneratedMock"
                  />
                </div>
              </div>
              <textarea
                v-model="aiGeneratedMock"
                class="w-full text-xs font-mono text-secondaryDark bg-primaryLight p-2 rounded resize-none focus:outline-none focus:ring-1 focus:ring-accent overflow-y-auto"
                style="height: 120px"
                spellcheck="false"
                readonly
              />
            </div>

            <!-- Field Types 解析结果 -->
            <div
              class="rounded border border-dividerLight p-3 flex-shrink-0 max-h-48 overflow-y-auto"
            >
              <h3 class="font-semibold text-secondaryDark mb-2 text-sm">
                {{ t("ai_mock.field_types") }}
              </h3>
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b border-dividerLight">
                    <th
                      class="text-left py-1 px-2 text-secondaryLight font-medium"
                    >
                      {{ t("ai_mock.field_name") }}
                    </th>
                    <th
                      class="text-left py-1 px-2 text-secondaryLight font-medium"
                    >
                      {{ t("ai_mock.field_type") }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(field, index) in parsedFieldTypes"
                    :key="index"
                    class="border-b border-dividerLight last:border-b-0"
                  >
                    <td class="py-1 px-2 font-mono text-secondaryDark text-xs">
                      {{ field.name || "-" }}
                    </td>
                    <td class="py-1 px-2">
                      <span
                        class="px-1.5 py-0.5 rounded text-xs font-medium"
                        :class="
                          field.type
                            ? getTypeClass(field.type)
                            : 'bg-gray-500/20 text-gray-500'
                        "
                      >
                        {{ field.type || "-" }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="parsedFieldTypes.length === 0">
                    <td
                      class="py-1 px-2 text-secondaryLight text-xs"
                      colspan="2"
                    >
                      {{ t("ai_mock.waiting_for_input") }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 全屏弹窗 -->
    <div
      v-if="showFullscreen"
      class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      @click.self="showFullscreen = false"
    >
      <div class="bg-primaryDark rounded-lg p-4 w-[90%] h-[90%] flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-secondaryDark">
            {{ t("ai_mock.mock_result") }}
          </h3>
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('action.close')"
            :icon="IconX"
            @click="showFullscreen = false"
          />
        </div>
        <textarea
          v-model="aiGeneratedMock"
          class="flex-1 w-full text-sm font-mono text-secondaryDark bg-primaryLight p-3 rounded resize-none focus:outline-none"
          spellcheck="false"
          readonly
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { knowledgeRequest } from "~/helpers/knowledge-api"

import IconClipboard from "~icons/lucide/clipboard"
import IconMaximize2 from "~icons/lucide/maximize-2"
import IconX from "~icons/lucide/x"

const t = useI18n()
const toast = useToast()

// AI Generate 输入模式：自然语言 或 JSON 模板，默认 JSON 模板
const aiInputMode = ref<"description" | "json">("json")

// AI 生成相关
const typePrompt = ref("")
// JSON 模板输入
const jsonTemplate = ref("")
const isGenerating = ref(false)
const aiGeneratedMock = ref("")
const errorMessage = ref("")

const parsedFieldTypes = ref<{ name: string; type: string }[]>([])
const showFullscreen = ref(false)

// AI 输入框高度控制（用于调整大小）
const aiInputHeight = ref(150) // 默认高度
const aiInputResizing = ref(false)
const aiInputResizeStartY = ref(0)
const aiInputResizeStartHeight = ref(0)

const startAiInputResize = (e: MouseEvent) => {
  e.preventDefault()
  aiInputResizing.value = true
  aiInputResizeStartY.value = e.clientY
  aiInputResizeStartHeight.value = aiInputHeight.value
  document.addEventListener("mousemove", doAiInputResize)
  document.addEventListener("mouseup", stopAiInputResize)
}

const doAiInputResize = (e: MouseEvent) => {
  if (!aiInputResizing.value) return
  const delta = e.clientY - aiInputResizeStartY.value
  const newHeight = aiInputResizeStartHeight.value + delta
  aiInputHeight.value = Math.max(80, newHeight) // 最小高度 80px
}

const stopAiInputResize = () => {
  aiInputResizing.value = false
  document.removeEventListener("mousemove", doAiInputResize)
  document.removeEventListener("mouseup", stopAiInputResize)
}

// 解析JSON字段类型
const parseFieldTypes = (
  obj: any,
  prefix = ""
): { name: string; type: string }[] => {
  const fields: { name: string; type: string }[] = []

  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      return parseFieldTypes(obj[0], prefix)
    }
    return []
  }

  if (obj !== null && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      const value = obj[key]
      const fieldName = prefix ? `${prefix}.${key}` : key

      // 检测 Java 时间类型
      const detectedJavaType = detectJavaTimeType(key, value)
      if (detectedJavaType) {
        fields.push({ name: fieldName, type: detectedJavaType })
        continue
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          fields.push({ name: fieldName, type: `${getType(value[0])}[]` })
        } else {
          fields.push({ name: fieldName, type: "any[]" })
        }
      } else if (value !== null && typeof value === "object") {
        fields.push(...parseFieldTypes(value, fieldName))
      } else {
        fields.push({ name: fieldName, type: getType(value) })
      }
    }
  }

  return fields
}

// Java 时间类型映射（用于自动检测）
// 注意：正则必须精确匹配完整的 Java 类型名称，避免错误匹配
const javaTimeTypes: Record<
  string,
  { pattern: RegExp; format: string; example: string }
> = {
  localDate: {
    pattern: /^(?:create|update|created|updated)?[Dd]ate$/i,
    format: "yyyy-MM-dd",
    example: "2025-01-15",
  },
  localTime: {
    pattern: /^[Ll]ocal[Tt]ime$|^[Tt]ime$/i,
    format: "HH:mm:ss",
    example: "09:22:10",
  },
  localDateTime: {
    pattern: /^(?:create|update)?[Dd]ate[Tt]ime$/i,
    format: "yyyy-MM-dd'T'HH:mm:ss",
    example: "2025-01-15T09:22:10",
  },
  instant: {
    pattern: /^[Ii]nstant$/i,
    format: "ISO_INSTANT",
    example: "2025-01-15T09:22:10Z",
  },
  zonedDateTime: {
    pattern: /^[Zz]oned[Dd]ate[Tt]ime$/i,
    format: "yyyy-MM-dd'T'HH:mm:ssXXX",
    example: "2025-01-15T09:22:10+08:00",
  },
  offsetDateTime: {
    pattern: /^[Oo]ffset[Dd]ate[Tt]ime$/i,
    format: "yyyy-MM-dd'T'HH:mm:ssXXX",
    example: "+08:00",
  },
  timestamp: {
    pattern: /^(?:create|update)?[Tt]imestamp$/i,
    format: "ISO_INSTANT",
    example: "1736931730000",
  },
}

// 检测 Java 时间类型
const detectJavaTimeType = (fieldName: string, value: any): string | null => {
  for (const [typeName, config] of Object.entries(javaTimeTypes)) {
    if (config.pattern.test(fieldName)) {
      // 如果是 timestamp，返回毫秒数
      if (
        typeName === "timestamp" &&
        (typeof value === "number" || /^\d{13}$/.test(String(value)))
      ) {
        return "long"
      }
      return typeName
    }
  }
  return null
}

const getType = (value: any): string => {
  if (value === null) return "null"
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "float"
  }
  return typeof value
}

const getTypeClass = (type: string) => {
  const typeColors: Record<string, string> = {
    string: "bg-blue-500/20 text-blue-500",
    integer: "bg-green-500/20 text-green-500",
    float: "bg-yellow-500/20 text-yellow-500",
    number: "bg-yellow-500/20 text-yellow-500",
    boolean: "bg-purple-500/20 text-purple-500",
    null: "bg-gray-500/20 text-gray-500",
    array: "bg-orange-500/20 text-orange-500",
    object: "bg-pink-500/20 text-pink-500",
    // Java 时间类型
    localDate: "bg-cyan-500/20 text-cyan-500",
    localTime: "bg-cyan-500/20 text-cyan-500",
    localDateTime: "bg-cyan-500/20 text-cyan-500",
    instant: "bg-cyan-500/20 text-cyan-500",
    zonedDateTime: "bg-cyan-500/20 text-cyan-500",
    offsetDateTime: "bg-cyan-500/20 text-cyan-500",
    timestamp: "bg-teal-500/20 text-teal-500",
    long: "bg-teal-500/20 text-teal-500",
  }
  return typeColors[type] || "bg-gray-500/20 text-gray-500"
}

// ========== 纯 AI 生成功能 ==========

// 提取 JSON（去除 markdown 代码块标记）
const extractJson = (text: string): string => {
  const m1 = text.match(/```json\s*([\s\S]*?)\s*```/i)
  if (m1) return m1[1].trim()
  const m2 = text.match(/```\s*([\s\S]*?)\s*```/)
  if (m2) return m2[1].trim()
  return text.trim()
}

/**
 * 从JSON示例中提取schema
 * 返回后端 JsonSchemaInferencer 期望的格式
 */
const extractJsonSchema = (obj: any): any => {
  if (obj === null) return { type: "object", properties: {}, required: [] }
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      return [extractJsonSchema(obj[0])]
    }
    return []
  }
  if (typeof obj === "object") {
    const properties: Record<string, any> = {}
    const required: string[] = []
    for (const [key, val] of Object.entries(obj)) {
      if (val !== null) {
        required.push(key)
      }
      if (val === null) {
        properties[key] = { type: "string" }
      } else if (typeof val === "string") {
        properties[key] = { type: "string" }
      } else if (typeof val === "number") {
        properties[key] = { type: Number.isInteger(val) ? "integer" : "number" }
      } else if (typeof val === "boolean") {
        properties[key] = { type: "boolean" }
      } else if (Array.isArray(val)) {
        properties[key] = {
          type: "array",
          items:
            val.length > 0
              ? {
                  type:
                    typeof val[0] === "number" && Number.isInteger(val[0])
                      ? "integer"
                      : "string",
                }
              : { type: "string" },
        }
      } else if (typeof val === "object") {
        properties[key] = extractJsonSchema(val)
      } else {
        properties[key] = { type: "string" }
      }
    }
    return { type: "object", properties, required }
  }
  return { type: "object", properties: {}, required: [] }
}

// 从后端 AI Mock 服务生成 Mock 数据
const generateFromAI = async () => {
  // 检查必填项
  if (aiInputMode.value === "description" && !typePrompt.value.trim()) {
    toast.error("请输入类型描述")
    return
  }
  if (aiInputMode.value === "json" && !jsonTemplate.value.trim()) {
    toast.error("请输入 JSON 模板")
    return
  }

  isGenerating.value = true
  errorMessage.value = ""

  try {
    if (aiInputMode.value === "json") {
      // JSON 模板模式：验证 JSON 格式
      try {
        JSON.parse(jsonTemplate.value)
      } catch {
        toast.error("JSON 模板格式错误，请检查")
        isGenerating.value = false
        return
      }
    }

    // 直接调用 LLM 生成
    const response = {
      data: await knowledgeRequest<any>("/api/mock/chat", {
        method: "POST",
        data: {
          mode: aiInputMode.value,
          typePrompt: typePrompt.value,
          jsonTemplate: jsonTemplate.value,
          temperature: 0.2,
        },
      }),
    }

    if (response.data.success) {
      const raw = extractJson(response.data.data)
      const parsed = JSON.parse(raw)
      aiGeneratedMock.value = JSON.stringify(parsed, null, 2)
      parsedFieldTypes.value = parseFieldTypes(parsed)
      toast.success(t("ai_mock.generated_success"))
    } else {
      errorMessage.value = response.data.error || t("ai_mock.generation_failed")
    }
  } catch (e: any) {
    console.error("AI Mock Error:", e)
    console.error("Response data:", e.response?.data)
    console.error("Request payload:", {
      url: e.config?.url,
      method: e.config?.method,
      data: e.config?.data,
    })
    const backendError =
      e.response?.data?.error || e.response?.data?.message || e.message
    errorMessage.value = backendError || t("ai_mock.generation_failed")
  } finally {
    isGenerating.value = false
  }
}

// 复制 AI 生成的 Mock 数据
const copyAiGeneratedMock = async () => {
  try {
    await navigator.clipboard.writeText(aiGeneratedMock.value)
    toast.success(t("action.copied_to_clipboard"))
  } catch (e) {
    toast.error(t("profile.no_permission"))
  }
}
</script>
