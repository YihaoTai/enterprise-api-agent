/**
 * API Search Service
 * 智能接口搜索 - 前端服务
 */
import { knowledgeRequest } from "./knowledge-api"

export interface SearchResult {
  id: string
  name: string
  path: string
  method: string
  description: string | null
  category: string | null
  requestid: string | null
  score: number
}

export interface APISpec {
  id: string
  name: string
  path: string
  method: string
  description: string | null
  category: string | null
}

export const searchAPIs = async (
  query: string,
  teamId?: string,
  limit = 10
): Promise<SearchResult[]> => {
  if (!teamId) return []
  const response = await knowledgeRequest<{ results: SearchResult[] }>(
    "/api-search/search",
    { method: "POST", data: { query, teamId, limit } }
  )
  return response.results
}
export const syncAPIs = async (
  teamId?: string
): Promise<{ synced: number; queued: number }> => {
  return knowledgeRequest("/api-search/sync", {
    method: "POST",
    data: { teamId },
  })
}
export const getAPISpecs = async (teamId?: string): Promise<APISpec[]> => {
  if (!teamId) return []
  const response = await knowledgeRequest<{ specs: APISpec[] }>(
    "/api-search/specs",
    { params: { teamId } }
  )
  return response.specs
}
