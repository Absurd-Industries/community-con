import { useCallback, useEffect, useState } from 'react'
import { maskEmail, maskTicket, voterIdHash } from './hash.js'

/**
 * The voter's identity for this session.
 *
 * Only the hash and two masked labels are kept. The raw ticket ID and email
 * exist in memory for exactly as long as it takes to hash them, which is the
 * property the backend team will want to preserve: a leaked ballot store must
 * not be a list of who attended, or of how to reach them.
 */

const KEY = 'community-con:ticket'

export interface TicketSession {
  hash: string
  masked: string
  maskedEmail: string
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

  const signIn = useCallback(async (rawTicket: string, rawEmail: string) => {
    const session: TicketSession = {
      hash: await voterIdHash(rawTicket, rawEmail),
      masked: maskTicket(rawTicket),
      maskedEmail: maskEmail(rawEmail),
    }
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
