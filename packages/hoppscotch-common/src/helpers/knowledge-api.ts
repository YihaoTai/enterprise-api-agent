import axios, { AxiosRequestConfig } from "axios"
import { platform } from "~/platform"

export async function knowledgeRequest<T>(
  path: string,
  config: AxiosRequestConfig = {}
): Promise<T> {
  const base = (
    import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3170"
  ).replace(/\/$/, "")
  const response = await axios.request<T>({
    ...platform.auth.axiosPlatformConfig?.(),
    ...config,
    url: `${base}${path}`,
    timeout: 180000,
    headers: { ...platform.auth.getBackendHeaders(), ...config.headers },
  })
  return response.data
}
export interface KnowledgeResult {
  id: string
  status: string
  answer: string
  citations: Array<{ id: string; name: string; method: string; path: string }>
  trace: Array<{
    step: number
    tool: string
    status: string
    elapsedMs: number
    output?: unknown
    count?: number
  }>
  validatedMocks: Array<{ apiId: string; data: unknown }>
}
