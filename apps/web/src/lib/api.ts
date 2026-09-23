import { getAdminPassword, clearAdminPassword } from './admin.js'

/**
 * The seam between the app and its data.
 *
 * Everything the app knows about the server goes through here. The API lives on
 * the same origin as the site - one Worker serves both - so there is no base URL
 * to configure and no CORS. In local development Vite proxies /api to the Worker
 * on :8787; see vite.config.ts.
 */

const ADMIN_PASSWORD_HEADER = 'X-Admin-Password'

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)

  // Default to JSON, but never for a FormData body: the browser has to set
  // that header itself so it can include the multipart boundary. Setting it
  // here breaks the CSV upload with an unhelpful parse error on the server.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  // Organiser calls carry the shared password. Voter calls carry nothing at all,
  // which is the point - a ballot must not be tied to anything identifying.
  if (path.startsWith('/api/admin/')) {
    const password = getAdminPassword()
    if (password) headers.set(ADMIN_PASSWORD_HEADER, password)
  }

  const response = await fetch(path, { ...options, headers })

  if (!response.ok) {
    // A stored password that has stopped working means the organisers changed
    // it. Forget it so the next render asks again instead of looping on 401s.
    if (response.status === 401 && path.startsWith('/api/admin/')) clearAdminPassword()

    let message = response.statusText
    try {
      const body = await response.json() as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // A non-JSON error body tells us nothing useful; the status line will do.
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T

  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes('application/json')) return response.json() as Promise<T>
  // CSV exports come back as a Blob for the download link to point at.
  return response.blob() as Promise<T>
}
