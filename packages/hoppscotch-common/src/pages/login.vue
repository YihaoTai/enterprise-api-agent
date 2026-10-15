<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-primary">
    <div class="w-full max-w-md px-4">
      <div class="flex flex-col items-center justify-center">
        <AppLogo class="h-16 w-16 rounded mb-8" />
        <h1 class="text-2xl font-bold text-secondaryDark mb-2">
          {{ isRegisterMode ? '注册账号' : t("auth.login_to_hoppscotch") }}
        </h1>
      </div>

      <form
        class="flex flex-col space-y-4 mt-8"
        @submit.prevent="isRegisterMode ? signUpWithPassword() : signInWithPassword()"
      >
        <HoppSmartInput
          v-model="form.email"
          type="text"
          placeholder=" "
          :label="t('auth.email')"
          input-styles="floating-input"
        />
        <HoppSmartInput
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder=" "
          :label="'密码'"
          input-styles="floating-input"
        >
          <template #button>
            <span class="end-actions">
              <button
                type="button"
                class="flex items-center px-2 text-secondaryLight hover:text-secondary"
                @click.stop="showPassword = !showPassword"
              >
                <component
                  :is="showPassword ? IconEyeOff : IconEye"
                  class="h-4 w-4"
                />
              </button>
            </span>
          </template>
        </HoppSmartInput>
        <HoppButtonPrimary
          :loading="signingInWithPassword"
          type="submit"
          :label="isRegisterMode ? '注册' : '登录'"
          class="w-full"
        />
        <div class="flex justify-center text-tiny text-secondaryLight">
          <span v-if="isRegisterMode">已有账号？
            <a class="link" @click="isRegisterMode = false">登录</a>
          </span>
          <span v-else>没有账号？
            <a class="link" @click="isRegisterMode = true">点此注册</a>
          </span>
        </div>
      </form>

      <div v-if="isLoadingAllowedAuthProviders" class="flex justify-center mt-8">
        <HoppSmartSpinner />
      </div>

      <div v-if="!isRegisterMode && allowedAuthProviders.length > 0" class="mt-8">
        <div class="flex items-center mb-4">
          <div class="flex-1 h-px bg-dividerLight"></div>
          <span class="px-4 text-tiny text-secondaryLight">或使用以下方式登录</span>
          <div class="flex-1 h-px bg-dividerLight"></div>
        </div>
        <div class="flex flex-col space-y-2">
          <HoppSmartItem
            v-for="provider in allowedAuthProviders"
            :key="provider.id"
            :loading="provider.isLoading.value"
            :icon="provider.icon"
            :label="provider.label"
            @click="provider.action"
          />
        </div>
      </div>

      <p class="mt-8 text-center text-tiny text-secondaryLight">
        登录即表示您同意我们的
        <a :href="tosLink" target="_blank" class="link">服务条款</a>
        和
        <a :href="privacyPolicyLink" target="_blank" class="link">隐私政策</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Ref, onMounted, ref } from "vue"
import { useRouter } from "vue-router"

import { useI18n } from "@composables/i18n"
import { useStreamSubscriber } from "@composables/stream"
import { useToast } from "@composables/toast"

import { platform } from "~/platform"

import IconGithub from "~icons/auth/github"
import IconGoogle from "~icons/auth/google"
import IconMicrosoft from "~icons/auth/microsoft"
import IconLock from "~icons/lucide/lock"
import IconEye from "~icons/lucide/eye"
import IconEyeOff from "~icons/lucide/eye-off"

import { useService } from "dioc/vue"
import { LoginItemDef } from "~/platform/auth"
import { PersistenceService } from "~/services/persistence"

import * as E from "fp-ts/Either"

const router = useRouter()
const t = useI18n()
const toast = useToast()

const persistenceService = useService(PersistenceService)

const form = {
  email: "",
  password: "",
}

const isLoadingAllowedAuthProviders = ref(true)

const signingInWithGoogle = ref(false)
const signingInWithGitHub = ref(false)
const signingInWithMicrosoft = ref(false)
const signingInWithPassword = ref(false)
const isRegisterMode = ref(false)
const showPassword = ref(false)

// We don't use magic link in this simplified login page

const tosLink = import.meta.env.VITE_APP_TOS_LINK
const privacyPolicyLink = import.meta.env.VITE_APP_PRIVACY_POLICY_LINK

type AuthProviderItem = {
  id: string
  icon: typeof IconGithub
  label: string
  action: (...args: any[]) => any
  isLoading: Ref<boolean>
}

let allowedAuthProviders: AuthProviderItem[] = []
const additionalLoginItems: LoginItemDef[] = []

const doAdditionalLoginItemClickAction = async (item: LoginItemDef) => {
  await item.onClick()
}

onMounted(async () => {
  const currentUser = platform.auth.getCurrentUser()
  if (currentUser) {
    // Already logged in, redirect to home
    router.push("/")
    return
  }

  const res = await platform.auth.getAllowedAuthProviders()

  if (E.isLeft(res)) {
    toast.error(`${t("error.authproviders_load_error")}`)
    isLoadingAllowedAuthProviders.value = false
    return
  }

  // setup the normal auth providers
  const enabledAuthProviders = authProvidersAvailable.filter((provider) =>
    res.right.includes(provider.id)
  )
  allowedAuthProviders = enabledAuthProviders

  // setup the additional login items
  platform.auth.additionalLoginItems?.forEach((item) => {
    if (res.right.includes(item.id)) {
      additionalLoginItems.push(item)
    }

    if (item.id === "OIDC") {
      res.right
        .filter((provider) => provider.startsWith("OIDC"))
        .forEach((provider) => {
          const OIDCName = provider.split(":")[1]
          const loginItemText = OIDCName
            ? () =>
                t("auth.continue_with_auth_provider", {
                  provider: OIDCName,
                })
            : item.text

          const OIDCLoginItem = {
            ...item,
            text: loginItemText,
          }
          additionalLoginItems.push(OIDCLoginItem)
        })
    }
  })

  isLoadingAllowedAuthProviders.value = false
})

const signInWithGoogle = async () => {
  signingInWithGoogle.value = true

  try {
    await platform.auth.signInUserWithGoogle()
    router.push("/")
  } catch (e) {
    console.error(e)
    toast.error(`${t("error.something_went_wrong")}`)
  }

  signingInWithGoogle.value = false
}

const signInWithGithub = async () => {
  signingInWithGitHub.value = true

  const result = await platform.auth.signInUserWithGithub()

  if (!result) {
    signingInWithGitHub.value = false
    return
  }

  if (result.type === "success") {
    router.push("/")
  } else if (result.type === "account-exists-with-different-cred") {
    toast.info(`${t("auth.account_exists")}`, {
      duration: 0,
      closeOnSwipe: false,
      action: {
        text: `${t("action.yes")}`,
        onClick: async (_, toastObject) => {
          await result.link()
          showLoginSuccess()
          router.push("/")

          toastObject.goAway(0)
        },
      },
    })
  } else {
    console.log("error logging into github", result.err)
    toast.error(`${t("error.something_went_wrong")}`)
  }

  signingInWithGitHub.value = false
}

const signInWithMicrosoft = async () => {
  signingInWithMicrosoft.value = true

  try {
    await platform.auth.signInUserWithMicrosoft()
    router.push("/")
  } catch (e) {
    console.error(e)
    toast.error(`${t("error.something_went_wrong")}`)
  }

  signingInWithMicrosoft.value = false
}

const showLoginSuccess = () => {
  toast.success(`${t("auth.login_success")}`)
}

const signInWithPassword = async () => {
  signingInWithPassword.value = true
  try {
    await platform.auth.signInUserWithPassword(form.email, form.password)
    showLoginSuccess()
    router.push("/")
  } catch (e) {
    console.error(e)
    toast.error("登录失败：" + (e?.message || "请检查用户名和密码"))
  } finally {
    signingInWithPassword.value = false
  }
}

const signUpWithPassword = async () => {
  signingInWithPassword.value = true
  try {
    await platform.auth.signUpUserWithPassword(form.email, form.password)
    showLoginSuccess()
    router.push("/")
  } catch (e) {
    console.error(e)
    toast.error("注册失败：" + (e?.message || "请检查输入信息"))
  } finally {
    signingInWithPassword.value = false
  }
}

const authProvidersAvailable: AuthProviderItem[] = [
  {
    id: "GITHUB",
    icon: IconGithub,
    label: t("auth.continue_with_github"),
    action: signInWithGithub,
    isLoading: signingInWithGitHub,
  },
  {
    id: "GITHUB:ENTERPRISE",
    icon: IconGithub,
    label: t("auth.continue_with_github_enterprise"),
    action: signInWithGithub,
    isLoading: signingInWithGitHub,
  },
  {
    id: "GOOGLE",
    icon: IconGoogle,
    label: t("auth.continue_with_google"),
    action: signInWithGoogle,
    isLoading: signingInWithGoogle,
  },
  {
    id: "MICROSOFT",
    icon: IconMicrosoft,
    label: t("auth.continue_with_microsoft"),
    action: signInWithMicrosoft,
    isLoading: signingInWithMicrosoft,
  },
]
</script>

<route lang="yaml">
meta:
  layout: empty
  requiresAuth: false
</route>
