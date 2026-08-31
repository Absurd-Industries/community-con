import { useSyncExternalStore } from 'react'

/**
 * Admin mode for the design preview.
 *
 * The real app puts the organiser pages behind Clerk. There are no accounts
 * here, so this is a local flag toggled from the demo bar - enough to show the
 * organiser surfaces without pretending to be access control. Anything behind
 * it is visible to anyone who opens devtools, which is fine for a preview and
 * is exactly what the backend team replaces.
 */

const KEY = 'community-con:admin'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

let current = read()

export function setAdminMode(enabled: boolean) {
  current = enabled
  try {
    window.localStorage.setItem(KEY, String(enabled))
  } catch {
    /* storage unavailable - the flag still holds for this tab */
  }
  listeners.forEach(listener => listener())
}

export function useAdminMode(): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => false
  )
}
