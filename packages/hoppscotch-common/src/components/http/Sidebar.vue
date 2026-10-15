<template>
  <HoppSmartTabs
    v-model="selectedNavigationTab"
    styles="sticky overflow-x-auto flex-shrink-0 bg-primary z-10 top-0"
    vertical
    render-inactive-tabs
  >
    <HoppSmartTab
      v-if="currentUser"
      :id="'collections'"
      :icon="IconFolder"
      :label="`${t('tab.collections')}`"
    >
      <Collections />
    </HoppSmartTab>
    <HoppSmartTab
      :id="'api-search'"
      :icon="IconSearch"
      :label="'Search'"
    >
      <!-- Search Input -->
      <div class="sticky top-0 z-10 border-b border-dividerLight bg-primary">
        <div class="p-3">
          <input
            v-model="apiSearchQuery"
            type="search"
            class="w-full px-3 py-2 bg-primaryDark border border-dividerLight rounded text-sm"
            placeholder="Search APIs by name, path..."
            @input="handleSearchInput"
          />
        </div>
      </div>
      <!-- Search Results - Inline (like History) -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="apiSearchResults.length > 0" class="divide-y divide-dividerLight">
          <div
            v-for="result in apiSearchResults"
            :key="result.id"
            class="flex items-center justify-between px-4 py-3 hover:bg-primaryDark cursor-pointer"
            @click="selectSearchResult(result)"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <span
                class="px-2 py-1 text-xs rounded font-medium shrink-0"
                :class="getMethodColor(result.method)"
              >
                {{ result.method }}
              </span>
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-sm font-medium truncate">{{ result.name }}</span>
                <span class="text-xs text-secondaryLight truncate">{{ result.path }}</span>
              </div>
            </div>
            <button
              class="px-2 py-1 text-xs bg-primaryDark hover:bg-dividerLight rounded shrink-0"
              @click.stop="copySearchResultCurl(result)"
            >
              cURL
            </button>
          </div>
        </div>
        <div
          v-else-if="apiSearchQuery.trim()"
          class="p-8 text-center text-secondaryLight text-sm"
        >
          No results found for "{{ apiSearchQuery }}"
        </div>
        <div
          v-else
          class="p-8 text-center text-secondaryLight text-sm"
        >
          Enter keywords to search APIs
        </div>
      </div>
    </HoppSmartTab>
  </HoppSmartTabs>
</template>

<script setup lang="ts">
import IconFolder from "~icons/lucide/folder"
import IconSearch from "~icons/lucide/search"
import { ref, computed } from "vue"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"
import { WorkspaceService } from "~/services/workspace.service"
import { getDefaultRESTRequest } from "@hoppscotch/data"
import { searchAPIs, type SearchResult } from "~/helpers/api-search.service"
import { platform } from "~/platform"

const t = useI18n()
const toast = useToast()
const tabService = useService(RESTTabService)
const workspaceService = useService(WorkspaceService)

// Check if user is logged in
const currentUser = computed(() => platform.auth.getCurrentUser())

// Get current team ID for filtering
const currentTeamID = computed(() => {
  const workspace = workspaceService.currentWorkspace.value
  return workspace.type === "team" ? workspace.teamID : undefined
})

// API Search state
const apiSearchQuery = ref("")
const apiSearchResults = ref<SearchResult[]>([])
const selectedSearchResult = ref<SearchResult | null>(null)

// API Search functions
const handleSearchInput = async () => {
  if (!apiSearchQuery.value.trim()) {
    apiSearchResults.value = []
    return
  }
  try {
    apiSearchResults.value = await searchAPIs(apiSearchQuery.value, currentTeamID.value)
  } catch (error) {
    console.error("API search failed:", error)
    apiSearchResults.value = []
  }
}

const selectSearchResult = (result: SearchResult) => {
  selectedSearchResult.value = result

  // Check if a tab with the same path and method is already open
  const existingTabs = tabService.getTabs()
  const existingTab = existingTabs.find(
    (tab) =>
      tab.document.type === "request" &&
      tab.document.request.endpoint === result.path &&
      tab.document.request.method === result.method
  )

  if (existingTab) {
    // Switch to existing tab
    tabService.setActiveTab(existingTab.id)
  } else {
    // Open request in new tab
    const newTab = tabService.createNewTab({
      type: "request",
      request: {
        ...getDefaultRESTRequest(),
        name: result.name,
        method: result.method,
        endpoint: result.path,
      },
      isDirty: false,
    })
    tabService.setActiveTab(newTab.id)
  }
}

const copySearchResultCurl = (result: SearchResult) => {
  const curl = `curl -X ${result.method} "${result.path}"`
  navigator.clipboard.writeText(curl).then(() => {
    toast.success("cURL copied to clipboard")
  })
}

const getMethodColor = (method: string) => {
  const m = method.toUpperCase()
  switch (m) {
    case "GET": return "bg-green-500 text-white"
    case "POST": return "bg-yellow-500 text-white"
    case "PUT": return "bg-blue-500 text-white"
    case "DELETE": return "bg-red-500 text-white"
    case "PATCH": return "bg-purple-500 text-white"
    default: return "bg-gray-500 text-white"
  }
}

type RequestOptionTabs = "collections" | "api-search"

const selectedNavigationTab = ref<RequestOptionTabs>("collections")
</script>
