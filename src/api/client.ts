const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Session cookies and patient records stay out of browser storage.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const csrfCookie = document.cookie.split('; ').find((entry) => entry.startsWith('csrfToken='))?.slice(10)
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (csrfCookie) headers.set('X-CSRF-Token', csrfCookie)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include', cache: 'no-store', headers })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('Spojení se nezdařilo. Zkontrolujte připojení a obnovte přehled před dalším pokusem.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('session-expired'))
    throw new ApiError(payload?.error?.message ?? 'Požadavek se nezdařil. Zkuste to znovu.', response.status, payload?.error?.code)
  }
  return payload.data as T
}
