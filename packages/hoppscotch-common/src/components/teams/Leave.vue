<template>
  <HoppSmartConfirmModal
    :show="show"
    :title="isOnlyOwner ? t('confirm.exit_team_as_owner') : t('confirm.exit_team')"
    :loading-state="loading"
    @hide-modal="hideModal"
    @resolve="confirmExit"
  />
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { pipe } from "fp-ts/function"
import * as TE from "fp-ts/TaskEither"
import { leaveTeam } from "~/helpers/backend/mutations/Team"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { GetMyTeamsQuery } from "~/helpers/backend/graphql"

const props = defineProps<{
  team: GetMyTeamsQuery["myTeams"][number]
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
  (e: "team-left"): void
}>()

const t = useI18n()
const toast = useToast()
const loading = ref(false)

// 判断是否是唯一 Owner
const isOnlyOwner = computed(() => {
  return props.team.myRole === "OWNER" && props.team.ownersCount === 1
})

const hideModal = () => {
  emit("hide-modal")
}

const confirmExit = () => {
  loading.value = true
  pipe(
    leaveTeam(props.team.id),
    TE.match(
      (err) => {
        toast.error(`${t("error.something_went_wrong")}`)
        console.error(err)
        loading.value = false
        hideModal()
      },
      () => {
        toast.success(
          isOnlyOwner.value
            ? `${t("team.left_and_deleted")}`
            : `${t("team.left")}`
        )
        loading.value = false
        emit("team-left")
        hideModal()
      }
    )
  )()
}
</script>
