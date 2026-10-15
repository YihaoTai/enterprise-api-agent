<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="`${t('export.title')}`"
    @close="hideModal"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div
          class="flex cursor-pointer flex-col rounded border border-dividerLight p-4 transition hover:border-accent"
          @click="exportAsMarkdown"
        >
          <div class="flex items-center gap-2">
            <i-lucide-file-text class="text-accent" />
            <span class="font-semibold text-secondaryDark">
              {{ t("export.markdown") }}
            </span>
          </div>
          <p class="mt-1 text-sm text-secondaryLight">
            {{ t("export.markdown_description") }}
          </p>
        </div>

        <div
          class="flex cursor-pointer flex-col rounded border border-dividerLight p-4 transition hover:border-accent"
          @click="exportAsOpenAPI"
        >
          <div class="flex items-center gap-2">
            <i-lucide-file-json class="text-accent" />
            <span class="font-semibold text-secondaryDark">
              {{ t("export.openapi") }}
            </span>
          </div>
          <p class="mt-1 text-sm text-secondaryLight">
            {{ t("export.openapi_description") }}
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <HoppButtonSecondary
        :label="`${t('action.dismiss')}`"
        outline
        filled
        @click="hideModal"
      />
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { ref } from "vue"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"
import { HoppRESTRequest } from "@hoppscotch/data"
import { platform } from "~/platform"

const t = useI18n()
const toast = useToast()
const tabs = useService(RESTTabService)

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const hideModal = () => emit("hide-modal")

const getCurrentRequest = (): HoppRESTRequest => {
  return tabs.currentActiveTab.value.document.request
}

const generateMarkdown = (req: HoppRESTRequest): string => {
  const lines: string[] = []

  lines.push(`# ${req.name || "API Request"}`)
  lines.push("")
  lines.push("## Basic Information")
  lines.push("")
  lines.push(`- **Method**: \`${req.method}\``)
  lines.push(`- **URL**: \`${req.endpoint}\``)
  lines.push("")

  // Headers
  if (req.headers && req.headers.length > 0) {
    const activeHeaders = req.headers.filter((h) => h.active)
    if (activeHeaders.length > 0) {
      lines.push("## Headers")
      lines.push("")
      lines.push("| Key | Value |")
      lines.push("|-----|-------|")
      activeHeaders.forEach((h) => {
        lines.push(`| ${h.key} | ${h.value} |`)
      })
      lines.push("")
    }
  }

  // Query Params
  if (req.params && req.params.length > 0) {
    const activeParams = req.params.filter((p) => p.active)
    if (activeParams.length > 0) {
      lines.push("## Query Parameters")
      lines.push("")
      lines.push("| Key | Value |")
      lines.push("|-----|-------|")
      activeParams.forEach((p) => {
        lines.push(`| ${p.key} | ${p.value} |`)
      })
      lines.push("")
    }
  }

  // Body
  if (req.body && req.body.body) {
    lines.push("## Request Body")
    lines.push("")
    if (req.body.contentType) {
      lines.push(`**Content-Type**: \`${req.body.contentType}\``)
      lines.push("")
    }
    if (typeof req.body.body === "string") {
      lines.push("```json")
      lines.push(req.body.body)
      lines.push("```")
    } else if (Array.isArray(req.body.body)) {
      lines.push("```json")
      lines.push(JSON.stringify(req.body.body, null, 2))
      lines.push("```")
    }
    lines.push("")
  }

  // Auth
  if (req.auth && req.auth.authType !== "none") {
    lines.push("## Authentication")
    lines.push("")
    lines.push(`- **Type**: ${req.auth.authType}`)
    if (req.auth.authType === "basic") {
      lines.push(`- **Username**: \`${req.auth.username}\``)
    } else if (req.auth.authType === "bearer") {
      lines.push(`- **Token**: \`${req.auth.token}\``)
    } else if (req.auth.authType === "api-key") {
      lines.push(`- **Key**: \`${req.auth.key}\``)
      lines.push(`- **Value**: \`${req.auth.value}\``)
      lines.push(`- **Add to**: \`${req.auth.addTo}\``)
    }
    lines.push("")
  }

  return lines.join("\n")
}

const generateOpenAPI = (req: HoppRESTRequest): string => {
  const openapi: any = {
    openapi: "3.0.0",
    info: {
      title: req.name || "API Request",
      version: "1.0.0",
    },
    paths: {
      [req.endpoint]: {
        [req.method.toLowerCase()]: {
          summary: req.name || "API Request",
          responses: {
            "200": {
              description: "Successful response",
            },
          },
        },
      },
    },
  }

  // Add headers
  if (req.headers && req.headers.length > 0) {
    const activeHeaders = req.headers.filter((h) => h.active)
    if (activeHeaders.length > 0) {
      const parameters: any[] = []
      activeHeaders.forEach((h) => {
        parameters.push({
          name: h.key,
          in: "header",
          schema: {
            type: "string",
          },
          example: h.value,
        })
      })
      openapi.paths[req.endpoint][req.method.toLowerCase()].parameters = parameters
    }
  }

  // Add query params
  if (req.params && req.params.length > 0) {
    const activeParams = req.params.filter((p) => p.active)
    if (activeParams.length > 0) {
      const parameters: any[] = []
      activeParams.forEach((p) => {
        parameters.push({
          name: p.key,
          in: "query",
          schema: {
            type: "string",
          },
          example: p.value,
        })
      })
      if (!openapi.paths[req.endpoint][req.method.toLowerCase()].parameters) {
        openapi.paths[req.endpoint][req.method.toLowerCase()].parameters = []
      }
      openapi.paths[req.endpoint][
        req.method.toLowerCase()
      ].parameters = openapi.paths[req.endpoint][
        req.method.toLowerCase()
      ].parameters?.concat(parameters)
    }
  }

  // Add body
  if (req.body && req.body.body) {
    const content: any = {}
    if (req.body.contentType === "application/json") {
      let example: any = req.body.body
      if (typeof req.body.body === "string") {
        try {
          example = JSON.parse(req.body.body)
        } catch {
          example = req.body.body
        }
      }
      content["application/json"] = {
        schema: {
          type: "object",
        },
        example,
      }
    } else if (req.body.contentType) {
      content[req.body.contentType] = {}
    }
    openapi.paths[req.endpoint][req.method.toLowerCase()].requestBody = {
      content,
    }
  }

  // Add auth
  if (req.auth && req.auth.authType !== "none") {
    const securitySchemes: any = {}
    if (req.auth.authType === "basic") {
      securitySchemes.basicAuth = {
        type: "http",
        scheme: "basic",
      }
    } else if (req.auth.authType === "bearer") {
      securitySchemes.bearerAuth = {
        type: "http",
        scheme: "bearer",
      }
    } else if (req.auth.authType === "api-key") {
      securitySchemes.apiKey = {
        type: "apiKey",
        in: req.auth.addTo || "header",
        name: req.auth.key || "api_key",
      }
    }

    if (Object.keys(securitySchemes).length > 0) {
      openapi.components = {
        securitySchemes,
      }
      openapi.paths[req.endpoint][req.method.toLowerCase()].security = [
        Object.keys(securitySchemes)[0],
      ]
    }
  }

  return JSON.stringify(openapi, null, 2)
}

const exportAsMarkdown = async () => {
  const req = getCurrentRequest()
  const markdown = generateMarkdown(req)

  try {
    downloadFile(markdown, `${req.name || "request"}.md`, "text/markdown")
    platform.analytics?.logEvent({
      type: "HOPP_REST_EXPORT_MARKDOWN",
    })
    hideModal()
  } catch (e) {
    console.error(e)
    toast.error(t("error.something_went_wrong"))
  }
}

const exportAsOpenAPI = async () => {
  const req = getCurrentRequest()
  const openapi = generateOpenAPI(req)

  try {
    downloadFile(openapi, `${req.name || "request"}-openapi.json`, "application/json")
    platform.analytics?.logEvent({
      type: "HOPP_REST_EXPORT_OPENAPI",
    })
    hideModal()
  } catch (e) {
    console.error(e)
    toast.error(t("error.something_went_wrong"))
  }
}

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success(t("export.file_saved"))
}
</script>
