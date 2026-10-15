<template>
  <HoppSmartModal v-if="show" dialog :title="t('team.new')" @close="hideModal">
    <template #body>
      <HoppSmartInput
        v-model="editingName"
        :label="t('action.label')"
        placeholder=" "
        input-styles="floating-input"
        @submit="addNewTeam"
      />
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.save')"
          :loading="isLoading"
          outline
          @click="addNewTeam"
        />
        <HoppButtonSecondary
          :label="t('action.cancel')"
          outline
          filled
          @click="hideModal"
        />
      </span>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { pipe } from "fp-ts/function"
import * as TE from "fp-ts/TaskEither"
import { createTeam } from "~/helpers/backend/mutations/Team"
import { TeamNameCodec } from "~/helpers/backend/types/TeamName"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { platform } from "~/platform"
import { useService } from "dioc/vue"
import { WorkspaceService } from "~/services/workspace.service"
import { useLocalState } from "~/newstore/localstate"

const t = useI18n()

const toast = useToast()

const props = defineProps<{
  show: boolean
  switchWorkspaceAfterCreation?: boolean
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const editingName = ref<string | null>(null)

const REMEMBERED_TEAM_ID = useLocalState("REMEMBERED_TEAM_ID")

const isLoading = ref(false)

const workspaceService = useService(WorkspaceService)

const addNewTeam = async () => {
  if (isLoading.value) {
    return
  }

  console.log("[TeamsAdd] addNewTeam called, editingName:", editingName.value)

  isLoading.value = true
  try {
    const result = await pipe(
      TeamNameCodec.decode(editingName.value),
      TE.fromEither,
      TE.mapLeft(() => "invalid_name" as const),
      TE.chainW(createTeam),
      TE.chainFirstIOK(
        () => () =>
          platform.analytics?.logEvent({
            type: "HOPP_CREATE_TEAM",
          })
      ),
      TE.match(
        (err) => {
          console.log("[TeamsAdd] Error:", err)
          // err is of type "invalid_name" | GQLError<Err>
          if (err === "invalid_name") {
            toast.error(`${t("team.name_length_insufficient")}`)
          } else if (typeof err === "object" && err !== null && "type" in err) {
            // GQL error
            const gqlErr = err as { type: string; error: string }
            console.error("[TeamsAdd] GQL Error:", gqlErr)
            toast.error(`创建失败: ${gqlErr.error || JSON.stringify(gqlErr)}`)
          } else {
            console.error("[TeamsAdd] Unknown error:", err)
            toast.error(`创建失败: ${err}`)
          }
        },
        (team) => {
          console.log("[TeamsAdd] Success, team created:", team)
          toast.success(`${t("team.new_created")}`)

          if (props.switchWorkspaceAfterCreation) {
            REMEMBERED_TEAM_ID.value = team.id
            workspaceService.changeWorkspace({
              teamID: team.id,
              teamName: team.name,
              type: "team",
              role: team.myRole,
            })
          }

          hideModal()
        }
      )
    )()
    console.log("[TeamsAdd] Result:", result)
  } catch (e) {
    console.error("[TeamsAdd] Unexpected error:", e)
    toast.error(`发生错误: ${e}`)
  } finally {
    isLoading.value = false
  }
}

const hideModal = () => {
  editingName.value = null
  emit("hide-modal")
}
</script>
