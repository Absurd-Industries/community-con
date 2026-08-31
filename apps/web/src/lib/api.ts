import { MockHttpError, handleRequest } from '../mock/handlers.js'

/**
 * The seam between the app and its data.
 *
 * In this design preview every call is served from localStorage - see
 * src/mock/. The signature is deliberately identical to the networked version
 * this replaced, so no page or component knows the difference.
 *
 * BACKEND TEAM: to point this at the real Worker, restore the fetch body below
 * and delete src/mock/. Nothing else in src/ needs to change.
 *
 *   const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}${path}`, { ...options, headers })
 *   if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
 *   return res.json()
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()

  let body: unknown = undefined
  if (typeof options.body === 'string') {
    // Talk CSV import posts raw text; everything else posts JSON.
    try {
      body = JSON.parse(options.body)
    } catch {
      body = options.body
    }
  } else if (options.body != null) {
    body = options.body
  }

  try {
    return (await handleRequest(method, path, body)) as T
  } catch (error) {
    if (error instanceof MockHttpError) throw new Error(error.message)
    throw error
  }
}
