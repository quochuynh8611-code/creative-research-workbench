import type { SearchRequest } from '@/lib/types'

export interface SearchExplorerState {
  query: string
  topic?: string
  source_type?: string
  golden?: boolean
  phase?: string
  top_k?: number
  offset?: number
  limit?: number
  session_id?: string
  from_tab?: string
}

/**
 * Serialize typed SearchExplorerState sang URL query string của trang /search.
 * Loại bỏ các trường rỗng, falsy hoặc default để giữ URL sạch.
 */
export function buildSearchExplorerUrl(state: Partial<SearchExplorerState>): string {
  const params = new URLSearchParams()

  const q = state.query?.trim()
  if (q) {
    params.set('q', q)
  }

  if (state.topic?.trim()) {
    params.set('topic', state.topic.trim())
  }

  if (state.source_type?.trim()) {
    params.set('source_type', state.source_type.trim())
  }

  if (state.golden === true) {
    params.set('golden', 'true')
  }

  if (state.phase?.trim()) {
    params.set('phase', state.phase.trim())
  }

  if (state.session_id?.trim()) {
    params.set('session_id', state.session_id.trim())
  }

  if (state.from_tab?.trim()) {
    params.set('from_tab', state.from_tab.trim())
  }

  if (state.top_k && state.top_k > 0 && state.top_k !== 10) {
    params.set('top_k', String(state.top_k))
  } else if (state.top_k && state.top_k > 0 && (state.golden || state.topic || state.source_type || state.phase)) {
    // Nếu có top_k được truyền và có các bộ lọc, giữ top_k nếu chỉ định rõ
    params.set('top_k', String(state.top_k))
  }

  const queryString = params.toString()
  return queryString ? `/search?${queryString}` : '/search'
}

/**
 * Parse URLSearchParams hoặc Record params từ Next.js sang typed SearchExplorerState.
 */
export function parseSearchExplorerParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): SearchExplorerState {
  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) || undefined
    }
    const val = searchParams[key]
    if (Array.isArray(val)) return val[0]
    return val || undefined
  }

  const rawQuery = getParam('q') || getParam('query') || ''
  const rawTopic = getParam('topic') || ''
  const rawSourceType = getParam('source_type') || ''
  const rawGolden = getParam('golden')
  const rawPhase = getParam('phase') || ''
  const rawTopK = getParam('top_k')
  const rawSessionId = getParam('session_id') || getParam('sessionId') || ''
  const rawFromTab = getParam('from_tab') || getParam('fromTab') || ''

  const golden = rawGolden === 'true' || rawGolden === '1'
  let topK = 10
  if (rawTopK) {
    const parsed = parseInt(rawTopK, 10)
    if (!isNaN(parsed) && parsed > 0) {
      topK = parsed
    }
  }

  return {
    query: rawQuery.trim(),
    topic: rawTopic.trim(),
    source_type: rawSourceType.trim(),
    golden,
    phase: rawPhase.trim(),
    top_k: topK,
    session_id: rawSessionId.trim() || undefined,
    from_tab: rawFromTab.trim() || undefined,
  }
}

/**
 * Chuẩn hóa SearchExplorerState thành SearchRequest payload gửi tới backend POST /api/v1/search.
 */
export function buildSearchPayload(state: SearchExplorerState): SearchRequest {
  const filters: Record<string, any> = {}

  if (state.topic?.trim()) {
    filters.topic = state.topic.trim()
  }

  if (state.source_type?.trim()) {
    filters.source_type = state.source_type.trim()
  }

  if (state.golden === true) {
    filters.golden = true
  }

  if (state.phase?.trim()) {
    filters.phase = state.phase.trim()
  }

  const payload: SearchRequest = {
    query: state.query.trim(),
    top_k: state.top_k && state.top_k > 0 ? state.top_k : 10,
  }

  if (state.offset !== undefined && state.offset >= 0) {
    payload.offset = state.offset
  }

  if (state.limit !== undefined && state.limit > 0) {
    payload.limit = state.limit
  }

  if (Object.keys(filters).length > 0) {
    payload.filters = filters
  }

  return payload
}
