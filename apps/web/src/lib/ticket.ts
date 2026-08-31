import { useCallback, useEffect, useState } from 'react'
import { maskTicket, sha256Hex } from './hash.js'

/**
 * The voter's identity for this session.
 *
 * Only the hash and a masked label are kept. The raw ticket ID exists in memory
 * for exactly as long as it takes to hash it, which is the property the backend
 * team will want to preserve: a leaked ballot store must not be a list of who
 * attended.
 */

const KEY = 'community-con:ticket'

export interface TicketSession {
  hash: string
  masked: string
}

function read(): TicketSession | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TicketSession
    return parsed?.hash ? parsed : null
  } catch {
    return null
  }
}

export function useTicket() {
  const [ticket, setTicket] = useState<TicketSession | null>(null)
  // sessionStorage is not available during SSR or in some privacy modes, and
  // reading it in an effect keeps the first paint identical either way.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setTicket(read())
    setReady(true)
  }, [])

  const signIn = useCallback(async (raw: string) => {
    const session: TicketSession = { hash: await sha256Hex(raw), masked: maskTicket(raw) }
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(session))
    } catch {
      /* not persisted, but valid for this page view */
    }
    setTicket(session)
    return session
  }, [])

  const signOut = useCallback(() => {
    try {
      window.sessionStorage.removeItem(KEY)
    } catch {
      /* nothing to clear */
    }
    setTicket(null)
  }, [])

  return { ticket, ready, signIn, signOut }
}
