const LOCKED_BALLOT_FIELDS = new Set([
  'votes_per_voter',
  'voting_opens_at',
  'voting_closes_at',
  'speaker_visibility',
])

export function validateVoteAllowance(value: number, talkCount: number, requireReady: boolean) {
  if (requireReady && value < 1) return 'Set at least 1 vote per voter before opening voting.'
  if (value > talkCount) return `Votes per voter cannot exceed the ${talkCount} eligible talks.`
  return null
}

export function conferencePatchTouchesLockedBallot(body: Record<string, unknown>) {
  return Object.keys(body).some(key => LOCKED_BALLOT_FIELDS.has(key))
}

export function validateTieBreak(
  selectedTalkId: string,
  tiedTalkIds: string[],
  talks: Array<{ id: string; vote_count: number }>,
) {
  const uniqueIds = [...new Set(tiedTalkIds)]
  if (uniqueIds.length < 2 || !uniqueIds.includes(selectedTalkId)) {
    return 'Select one talk from a tie group containing at least two talks.'
  }
  if (talks.length !== uniqueIds.length || talks.some(talk => !uniqueIds.includes(talk.id))) {
    return 'Every tie-break talk must belong to the current conference.'
  }
  if (new Set(talks.map(talk => talk.vote_count)).size !== 1) {
    return 'Tie-break talks must have equal community vote totals.'
  }
  return null
}
