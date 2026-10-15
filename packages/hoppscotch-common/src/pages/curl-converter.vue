<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 p-4">
      <h2 class="text-lg font-semibold mb-4 text-secondaryDark">
        {{ t("curl_converter.title") }}
      </h2>

      <div class="flex flex-col gap-4">
        <!-- cURL 输入区 -->
        <div class="rounded border border-dividerLight">
          <div class="flex items-center justify-between pl-4 py-2">
            <label class="font-semibold text-secondaryLight">
              cURL
            </label>
            <div class="flex items-center">
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('action.clear_all')"
                :icon="IconTrash2"
                @click="clearContent()"
              />
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('action.copy')"
                :icon="copyIcon"
                @click="copyContent"
              />
            </div>
          </div>
          <div class="h-46">
            <div
              ref="curlEditor"
              class="h-full rounded-b border-t border-dividerLight"
            ></div>
          </div>
        </div>

        <!-- 解析按钮 -->
        <div class="flex justify-center">
          <HoppButtonPrimary
            :label="t('curl_converter.parse')"
            :disabled="!curlInput.trim()"
            @click="handleParse"
          />
        </div>

        <!-- 解析结果 -->
        <div v-if="parseResult" class="rounded border border-dividerLight p-4">
          <h3 class="font-semibold text-secondaryDark mb-2">
            {{ t("curl_converter.result") }}
          </h3>

          <!-- 方法和URL -->
          <div class="flex items-center gap-2 mb-4">
            <span
              class="px-2 py-1 rounded text-sm font-medium"
              :class="getMethodClass(parseResult.method)"
            >
              {{ parseResult.method }}
            </span>
            <span class="text-secondaryDark font-mono text-sm break-all">
              {{ parseResult.endpoint }}
            </span>
          </div>

          <!-- Headers -->
          <div v-if="parseResult.headers.length > 0" class="mb-4">
            <h4 class="text-sm font-medium text-secondaryLight mb-2">
              {{ t("request.headers") }} ({{ parseResult.headers.length }})
            </h4>
            <div class="space-y-1">
              <div
                v-for="(header, index) in parseResult.headers"
                :key="index"
                class="flex gap-2 text-sm font-mono"
              >
                <span class="text-secondary">{{ header.key }}:</span>
                <span class="text-secondaryDark">{{ header.value }}</span>
              </div>
            </div>
          </div>

          <!-- Params -->
          <div v-if="parseResult.params.length > 0" class="mb-4">
            <h4 class="text-sm font-medium text-secondaryLight mb-2">
              {{ t("request.parameters") }} ({{ parseResult.params.length }})
            </h4>
            <div class="space-y-1">
              <div
                v-for="(param, index) in parseResult.params"
                :key="index"
                class="flex gap-2 text-sm font-mono"
              >
                <span class="text-secondary">{{ param.key }}:</span>
                <span class="text-secondaryDark">{{ param.value }}</span>
              </div>
            </div>
          </div>

          <!-- Body -->
          <div v-if="hasBodyContent" class="mb-4">
            <h4 class="text-sm font-medium text-secondaryLight mb-2">
              {{ t("request.body") }}
              <span v-if="parseResult.body.contentType" class="text-xs text-secondary">
                ({{ parseResult.body.contentType }})
              </span>
            </h4>
            <pre class="text-sm font-mono text-secondaryDark bg-primaryLight p-2 rounded overflow-x-auto">{{ getBodyDisplay() }}</pre>
          </div>

          <!-- 转换为 cURL 按钮 -->
          <div class="flex gap-2 mt-4">
            <HoppButtonSecondary
              :label="t('curl_converter.to_curl')"
              @click="handleToCurl"
            />
            <HoppButtonPrimary
              :label="t('curl_converter.open_in_hoppscotch')"
              @click="handleOpenInHoppscotch"
            />
          </div>

          <!-- 生成的 cURL -->
          <div v-if="generatedCurl" class="mt-4">
            <h4 class="text-sm font-medium text-secondaryLight mb-2">
              {{ t("curl_converter.generated_curl") }}
            </h4>
            <div class="relative">
              <pre class="text-sm font-mono text-secondaryDark bg-primaryLight p-2 rounded overflow-x-auto">{{ generatedCurl }}</pre>
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('action.copy')"
                :icon="copyIcon"
                class="absolute top-2 right-2"
                @click="copyGeneratedCurl"
              />
            </div>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="errorMessage" class="rounded border border-red-500 bg-red-500/10 p-4">
          <p class="text-red-500">{{ errorMessage }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue"
import { refAutoReset } from "@vueuse/core"
import { useCodemirror } from "@composables/codemirror"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { parseCurlToHoppRESTReq, hoppRESTReqToCurl } from "~/helpers/curl"
import { HoppRESTRequest, HoppRESTReqBody } from "@hoppscotch/data"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"
import { platform } from "~/platform"
import type { FormDataKeyValue } from "@hoppscotch/data"

import IconTrash2 from "~icons/lucide/trash-2"
import IconClipboard from "~icons/lucide/clipboard"
import IconCheck from "~icons/lucide/check"

const t = useI18n()
const toast = useToast()
const tabs = useService(RESTTabService)

const curlInput = ref("")
const curlEditor = ref<any | null>(null)
const parseResult = ref<HoppRESTRequest | null>(null)
const generatedCurl = ref("")
const errorMessage = ref("")

const copyIcon = refAutoReset<typeof IconClipboard | typeof IconCheck>(
  IconClipboard,
  1000
)

// Compute body display content
const hasBodyContent = computed(() => {
  if (!parseResult.value?.body) return false
  const body = parseResult.value.body
  if (body.contentType === null) return false
  if (body.contentType === "multipart/form-data") {
    return body.body.length > 0
  }
  if (body.contentType === "application/x-www-form-urlencoded") {
    return !!body.body
  }
  if (typeof body.body === "string") {
    return !!body.body
  }
  return false
})

const getBodyDisplay = () => {
  if (!parseResult.value?.body) return ""
  const body = parseResult.value.body
  if (body.contentType === "multipart/form-data") {
    return body.body
      .map((item: FormDataKeyValue) => `${item.key}: ${item.value}`)
      .join("\n")
  }
  if (typeof body.body === "string") {
    return body.body
  }
  return JSON.stringify(body.body, null, 2)
}

useCodemirror(
  curlEditor,
  curlInput,
  reactive({
    extendedEditorConfig: {
      mode: "application/x-sh",
      placeholder: `${t("request.enter_curl")}`,
      lineWrapping: true,
    },
    linter: null,
    completer: null,
    environmentHighlights: false,
  })
)

const clearContent = () => {
  curlInput.value = ""
  parseResult.value = null
  generatedCurl.value = ""
  errorMessage.value = ""
}

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(curlInput.value)
    copyIcon.value = IconCheck
    toast.success(t("action.copied_to_clipboard"))
  } catch (e) {
    toast.error(t("profile.no_permission"))
  }
}

const handleParse = () => {
  errorMessage.value = ""
  try {
    const result = parseCurlToHoppRESTReq(curlInput.value)
    parseResult.value = result
    platform.analytics?.logEvent({
      type: "HOPP_REST_PARSE_CURL",
    })
  } catch (e) {
    console.error(e)
    errorMessage.value = t("error.curl_invalid_format")
    parseResult.value = null
  }
}

const handleToCurl = () => {
  if (parseResult.value) {
    generatedCurl.value = hoppRESTReqToCurl(parseResult.value)
  }
}

const handleOpenInHoppscotch = () => {
  if (parseResult.value) {
    const tab = tabs.createNewTab({
      type: "request",
      request: parseResult.value,
      isDirty: true,
    })
    tabs.setActiveTab(tab.id)
    // 跳转到 REST 页面
    window.location.href = "/"
  }
}

const copyGeneratedCurl = async () => {
  try {
    await navigator.clipboard.writeText(generatedCurl.value)
    toast.success(t("action.copied_to_clipboard"))
  } catch (e) {
    toast.error(t("profile.no_permission"))
  }
}

const getMethodClass = (method: string) => {
  const methodColors: Record<string, string> = {
    GET: "bg-green-500/20 text-green-500",
    POST: "bg-yellow-500/20 text-yellow-500",
    PUT: "bg-blue-500/20 text-blue-500",
    DELETE: "bg-red-500/20 text-red-500",
    PATCH: "bg-purple-500/20 text-purple-500",
  }
  return methodColors[method] || "bg-gray-500/20 text-gray-500"
}
</script>