import type { Conference } from './types.js'

type BallotState = Pick<Conference, 'ballot_locked_at' | 'voting_force_status' | 'voting_opens_at'>

export function recommendedVotes(talkCount: number) {
  if (talkCount <= 0) return 0
  return Math.max(1, Math.round(talkCount / 4))
}

export function ballotTalkCount(currentEligibleCount: number, lockedTalkCount: number | null) {
  return lockedTalkCount ?? currentEligibleCount
}

export function isBallotLocked(conference: BallotState, now = Date.now()) {
  if (conference.ballot_locked_at !== null) return true
  if (conference.voting_force_status === 'open') return true
  return conference.voting_force_status === 'scheduled'
    && conference.voting_opens_at !== null
    && now >= conference.voting_opens_at
}
