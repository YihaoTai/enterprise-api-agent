import { runMutation } from "@helpers/backend/GQLClient"
import axios from "axios"
import * as E from "fp-ts/Either"
import { z } from "zod"
import {
  UpdateUserDisplayNameDocument,
  UpdateUserDisplayNameMutation,
  UpdateUserDisplayNameMutationVariables,
} from "@app/api/generated/graphql"
import { getService } from "@hoppscotch/common/modules/dioc"
import { PersistenceService } from "@hoppscotch/common/services/persistence"

const persistenceService = getService(PersistenceService)

const expectedAllowedProvidersSchema = z.object({
  // currently supported values are "GOOGLE", "GITHUB", "EMAIL", "MICROSOFT", "SAML"
  // keeping it as string to avoid backend accidentally breaking frontend when adding new providers
  providers: z.array(z.string()),
})

export const getAllowedAuthProviders = async () => {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_BACKEND_API_URL}/auth/providers`,
      {
        withCredentials: true,
      }
    )

    const parseResult = expectedAllowedProvidersSchema.safeParse(res.data)

    if (!parseResult.success) {
      return E.left("SOMETHING_WENT_WRONG")
    }

    return E.right(parseResult.data.providers)
  } catch (_) {
    return E.left("SOMETHING_WENT_WRONG")
  }
}

export const updateUserDisplayName = (updatedDisplayName: string) =>
  runMutation<
    UpdateUserDisplayNameMutation,
    UpdateUserDisplayNameMutationVariables,
    ""
  >(UpdateUserDisplayNameDocument, {
    updatedDisplayName,
  })()

const TokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
})

export const signInWithPassword = async (email: string, password: string) => {
  try {
    await axios.post(
      `${import.meta.env.VITE_BACKEND_API_URL}/auth/signin-password`,
      { email, password },
      { withCredentials: true }
    )

    // Tokens are set via HttpOnly cookies, not in response body
    // Successful response (2xx) means cookies were set correctly
    return E.right(true)
  } catch (error: any) {
    if (error.response?.data?.message) {
      return E.left(error.response.data.message)
    }
    return E.left("SOMETHING_WENT_WRONG")
  }
}

export const signUpWithPassword = async (
  email: string,
  password: string,
  displayName?: string,
) => {
  try {
    await axios.post(
      `${import.meta.env.VITE_BACKEND_API_URL}/auth/signup`,
      { email, password, displayName },
      { withCredentials: true }
    )

    // Tokens are set via HttpOnly cookies, not in response body
    // Successful response (2xx) means cookies were set correctly
    return E.right(true)
  } catch (error: any) {
    if (error.response?.data?.message) {
      return E.left(error.response.data.message)
    }
    return E.left("SOMETHING_WENT_WRONG")
  }
}
