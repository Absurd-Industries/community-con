import { useSyncExternalStore } from 'react'

/**
 * The organiser password.
 *
 * There are no accounts in this project. Organisers share one password, set on
 * the deployment as a Cloudflare secret; this holds the copy the browser typed
 * and sends it on organiser requests.
 *
 * It lives in sessionStorage, not localStorage, so closing the tab forgets it.
 * A laptop open on a conference table is the realistic threat here, not an
 * attacker with a debugger - anyone with devtools on the organiser's own
 * machine can read this either way, and pretending otherwise would be worse
 * than saying so.
 */

const KEY = 'community-con:admin-password'
const listeners = new Set<() => void>()

function read(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

let current = read()

export function getAdminPassword(): string {
  return current
}

export function setAdminPassword(password: string) {
  current = password
  try {
    window.sessionStorage.setItem(KEY, password)
  } catch {
    /* storage unavailable - the password still holds for this tab */
  }
  listeners.forEach(listener => listener())
}

export function clearAdminPassword() {
  current = ''
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
  listeners.forEach(listener => listener())
}

/** True once a password has been entered. Whether it WORKS is the server's call. */
export function useAdminMode(): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current !== '',
    () => false
  )
}
