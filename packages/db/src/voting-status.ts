import type { Conference } from './types.js'

export type VotingStatus = 'open' | 'closed'

export function getVotingStatus(
  conference: Pick<Conference, 'voting_force_status' | 'voting_opens_at' | 'voting_closes_at' | 'votes_per_voter'>,
  now = Date.now()
): VotingStatus {
  if (conference.votes_per_voter === 0) return 'closed'
  if (conference.voting_force_status === 'open') return 'open'
  if (conference.voting_force_status === 'closed') return 'closed'
  const opens = conference.voting_opens_at
  const closes = conference.voting_closes_at
  if (!opens || !closes) return 'closed'
  return now >= opens && now <= closes ? 'open' : 'closed'
}
