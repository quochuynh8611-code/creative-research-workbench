import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Sessions
export const createSession = (data: { title: string; domain: string; tags: string[] }) =>
  apiClient.post('/sessions', data).then((r) => r.data)

export const listSessions = (params?: Record<string, string>) =>
  apiClient.get('/sessions', { params }).then((r) => r.data)

export const getSession = (id: string) =>
  apiClient.get(`/sessions/${id}`).then((r) => r.data)

// Search
export const semanticSearch = (query: string, sessionId?: string) =>
  apiClient.post('/search', { query, session_id: sessionId, limit: 10 }).then((r) => r.data)

// Problem frames
export const createProblemFrame = (sessionId: string, rawStatement: string) =>
  apiClient
    .post(`/sessions/${sessionId}/problem-frames`, { raw_problem_statement: rawStatement })
    .then((r) => r.data)
