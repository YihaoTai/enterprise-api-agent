<template>
  <main class="knowledge-page">
    <header class="hero">
      <span class="eyebrow">研发协作 / KNOWLEDGE WORKSPACE</span>
      <h1>让接口知识，连接下一步行动。</h1>
      <p>检索团队接口、理解参数约束，让研发助手协助准备测试数据。</p>
      <div class="workspace-badge">
        {{ teamName || "请先在顶部选择团队工作区" }}
      </div>
    </header>
    <div class="knowledge-grid">
      <section class="work-panel">
        <div class="mode-switch" role="group" aria-label="选择任务模式">
          <button :class="{ selected: mode === 'rag' }" @click="mode = 'rag'">
            知识库问答
          </button>
          <button
            :class="{ selected: mode === 'agent' }"
            @click="mode = 'agent'"
          >
            Agent 工作流
          </button>
        </div>
        <p class="mode-hint">
          {{
            mode === "rag"
              ? "基于团队接口资料回答，附上可核对的来源。"
              : "助手按需检索、读取接口结构，并校验生成的 Mock 数据。"
          }}
        </p>
        <form @submit.prevent="run">
          <label for="knowledge-query">描述你的研发任务</label>
          <textarea
            id="knowledge-query"
            v-model="query"
            maxlength="2000"
            rows="5"
            placeholder="找到修改成员资料的接口，解释请求参数，并生成一份测试数据。"
          />
          <div class="prompt-examples">
            <button
              v-for="example in examples"
              :key="example"
              type="button"
              @click="query = example"
            >
              {{ example }}
            </button>
          </div>
          <button
            class="primary-action"
            :disabled="busy || !teamId || !query.trim()"
          >
            {{
              busy
                ? "正在检索与处理…"
                : mode === "rag"
                  ? "查询知识库 →"
                  : "执行任务 →"
            }}
          </button>
        </form>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <section v-if="result" class="result" aria-live="polite">
          <div class="section-heading">
            <h2>处理结果</h2>
            <span>{{ result.status }}</span>
          </div>
          <p class="answer">{{ result.answer }}</p>
          <div v-if="result.citations.length" class="sources">
            <h3>参考接口</h3>
            <article v-for="source in result.citations" :key="source.id">
              <span class="method">{{ source.method }}</span
              ><strong>{{ source.name }}</strong> <code>{{ source.path }}</code
              ><small>{{ source.id }}</small>
            </article>
          </div>
          <div
            v-for="(mock, index) in result.validatedMocks"
            :key="index"
            class="mock-result"
          >
            <h3>通过结构校验的 Mock · {{ mock.apiId }}</h3>
            <pre>{{ JSON.stringify(mock.data, null, 2) }}</pre>
            <small>校验依据为接口样例推断的结构，业务约束仍需确认。</small>
          </div>
          <h3 v-if="result.trace.length">执行过程</h3>
          <details
            v-for="step in result.trace"
            :key="step.step"
            class="trace-step"
          >
            <summary>
              <span>{{ step.step }}. {{ step.tool }}</span
              ><small>{{ step.status }} · {{ step.elapsedMs }} ms</small>
            </summary>
            <pre>{{
              JSON.stringify(step.output ?? { count: step.count }, null, 2)
            }}</pre>
          </details>
        </section>
      </section>
      <aside class="context-panel">
        <section>
          <div class="section-heading">
            <h2>知识索引</h2>
            <button :disabled="!teamId || refreshing" @click="refresh">
              刷新
            </button>
          </div>
          <p>接口变更在后台同步，失败任务可重新入队。</p>
          <div v-if="statuses.length" class="status-grid">
            <div v-for="s in statuses" :key="s.status">
              <strong>{{ s.count }}</strong
              ><span>{{ statusLabels[s.status] || s.status }}</span>
            </div>
          </div>
          <p v-else>暂无索引状态，请选择团队并同步接口。</p>
          <div class="index-actions">
            <button :disabled="!canEdit || syncing" @click="sync(false)">
              同步接口</button
            ><button :disabled="!canEdit || syncing" @click="sync(true)">
              重试失败项
            </button>
          </div>
          <p v-if="notice" role="status">{{ notice }}</p>
        </section>
        <section>
          <h2>最近任务</h2>
          <p v-if="!history.length">完成第一个任务后，可在这里回看结果。</p>
          <button
            v-for="item in history"
            :key="item.id"
            class="history-item"
            :disabled="!item.result"
            @click="result = item.result"
          >
            <strong>{{
              item.mode === "rag" ? "知识库问答" : "Agent 工作流"
            }}</strong>
            <span
              >{{ item.status }} ·
              {{ new Date(item.createdAt).toLocaleString() }}</span
            >
          </button>
        </section>
      </aside>
    </div>
  </main>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useService } from "dioc/vue"
import { WorkspaceService } from "~/services/workspace.service"
import { knowledgeRequest, type KnowledgeResult } from "~/helpers/knowledge-api"
const workspace = useService(WorkspaceService)
const teamId = computed(() =>
  workspace.currentWorkspace.value.type === "team"
    ? workspace.currentWorkspace.value.teamID
    : ""
)
const teamName = computed(() =>
  workspace.currentWorkspace.value.type === "team"
    ? workspace.currentWorkspace.value.teamName
    : ""
)
const canEdit = computed(
  () =>
    workspace.currentWorkspace.value.type === "team" &&
    ["OWNER", "EDITOR"].includes(workspace.currentWorkspace.value.role || "")
)
const mode = ref<"rag" | "agent">("rag")
const query = ref("")
const busy = ref(false),
  syncing = ref(false),
  refreshing = ref(false)
const error = ref(""),
  notice = ref("")
const result = ref<KnowledgeResult | null>(null)
const statuses = ref<Array<{ status: string; count: number }>>([])
const history = ref<
  Array<{
    id: string
    mode: string
    status: string
    createdAt: string
    result: KnowledgeResult | null
  }>
>([])
const statusLabels: Record<string, string> = {
  ready: "已就绪",
  pending: "待同步",
  processing: "同步中",
  failed: "同步失败",
}
const examples = [
  "如何修改成员资料？",
  "查找订单相关接口",
  "找到创建用户的接口并生成 Mock",
]
let generation = 0
async function refresh() {
  const team = teamId.value,
    current = generation
  if (!team) return
  refreshing.value = true
  try {
    const [state, runs] = await Promise.all([
      knowledgeRequest<typeof statuses.value>("/api-search/status", {
        params: { teamId: team },
      }),
      knowledgeRequest<typeof history.value>("/knowledge/runs", {
        params: { teamId: team },
      }),
    ])
    if (current === generation) {
      statuses.value = state
      history.value = runs
    }
  } catch {
    if (current === generation)
      error.value = "无法读取团队数据，请确认登录状态和后端服务。"
  } finally {
    if (current === generation) refreshing.value = false
  }
}
async function run() {
  if (!teamId.value || busy.value) return
  const current = generation
  busy.value = true
  error.value = ""
  result.value = null
  try {
    const response = await knowledgeRequest<KnowledgeResult>("/knowledge/run", {
      method: "POST",
      data: {
        teamId: teamId.value,
        query: query.value.trim(),
        mode: mode.value,
      },
    })
    if (current === generation) {
      result.value = response
      await refresh()
    }
  } catch {
    if (current === generation)
      error.value = "任务请求失败，请检查登录状态、网络或模型配置。"
  } finally {
    if (current === generation) busy.value = false
  }
}
async function sync(retry: boolean) {
  const current = generation
  syncing.value = true
  error.value = ""
  try {
    const data = await knowledgeRequest<{ queued: number }>(
      retry ? "/api-search/retry" : "/api-search/sync",
      { method: "POST", data: { teamId: teamId.value } }
    )
    if (current === generation) {
      notice.value = `已提交 ${data.queued} 项后台同步任务。`
      await refresh()
    }
  } catch {
    if (current === generation)
      error.value = "同步失败，需要团队编辑权限及可用的数据库。"
  } finally {
    if (current === generation) syncing.value = false
  }
}
watch(
  teamId,
  () => {
    generation++
    result.value = null
    statuses.value = []
    history.value = []
    error.value = ""
    notice.value = ""
    busy.value = false
    syncing.value = false
    refreshing.value = false
    void refresh()
  },
  { immediate: true }
)
</script>
<style scoped>
.knowledge-page {
  max-width: 1320px;
  margin: auto;
  padding: 40px 32px 80px;
  color: var(--secondary-color);
}
.hero {
  padding: 12px 0 32px;
  border-bottom: 1px solid var(--divider-color);
  margin-bottom: 28px;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--accent-color);
}
h1 {
  font-size: clamp(24px, 3vw, 36px);
  line-height: 1.4;
  font-weight: 650;
  margin: 16px 0 12px;
  color: var(--secondary-dark-color);
}
p {
  line-height: 1.8;
}
.workspace-badge {
  display: inline-block;
  margin-top: 18px;
  border: 1px solid var(--divider-color);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 12px;
}
.knowledge-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 28px;
}
.work-panel,
.context-panel section {
  border: 1px solid var(--divider-color);
  border-radius: 14px;
  padding: 24px;
  background: var(--primary-color);
}
.context-panel section + section {
  margin-top: 20px;
}
.mode-switch {
  display: flex;
  gap: 8px;
}
button {
  cursor: pointer;
  border-radius: 8px;
  padding: 9px 12px;
  border: 1px solid var(--divider-color);
  transition: background 0.15s;
}
button:hover {
  background: var(--primary-light-color);
}
button:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 3px;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.selected {
  color: var(--accent-color);
  border-color: var(--accent-color);
}
.mode-hint {
  margin: 14px 0 24px;
  font-size: 12px;
}
label {
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  background: var(--primary-light-color);
  border: 1px solid var(--divider-color);
  padding: 16px;
  border-radius: 10px;
  line-height: 1.8;
}
.prompt-examples {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 12px 0 20px;
  font-size: 11px;
}
.primary-action {
  background: var(--accent-color);
  color: var(--accent-contrast-color, white);
  border: none;
  padding: 12px 20px;
}
.primary-action:hover {
  background: var(--accent-dark-color, var(--accent-color));
}
h2 {
  font-size: 15px;
  font-weight: 650;
}
h3 {
  font-size: 13px;
  margin: 22px 0 12px;
  font-weight: 600;
}
.context-panel p {
  margin: 12px 0;
  font-size: 12px;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.section-heading span,
.section-heading button {
  font-size: 11px;
}
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 20px 0;
}
.status-grid div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.status-grid strong {
  font-size: 24px;
}
.status-grid span {
  font-size: 11px;
}
.index-actions {
  display: flex;
  gap: 8px;
  font-size: 11px;
}
.history-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 7px;
  text-align: left;
  margin-top: 12px;
  font-size: 12px;
}
.history-item span {
  font-size: 10px;
}
.result {
  border-top: 1px solid var(--divider-color);
  margin-top: 28px;
  padding-top: 24px;
}
.answer {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin-top: 16px;
}
.sources article {
  padding: 12px;
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  margin: 8px 0;
}
.method {
  color: var(--accent-color);
  font-size: 11px;
  margin-right: 10px;
}
.sources code,
.sources small {
  display: block;
  margin-top: 6px;
  overflow-wrap: anywhere;
  font-size: 11px;
}
pre {
  overflow: auto;
  max-height: 320px;
  padding: 14px;
  background: var(--primary-light-color);
  border-radius: 8px;
  font-size: 12px;
}
.trace-step {
  border-top: 1px solid var(--divider-color);
  padding: 12px 0;
}
summary {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
small {
  font-size: 11px;
}
.error {
  color: #ef4444;
  margin-top: 16px;
}
@media (max-width: 900px) {
  .knowledge-grid {
    grid-template-columns: 1fr;
  }
  .knowledge-page {
    padding: 24px 16px;
  }
  .work-panel {
    padding: 18px;
  }
}
</style>
