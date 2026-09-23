/**
 * Ballots and the tally rule.
 *
 * Shared between the Worker and the browser on purpose. The counting rule is
 * the only part of this system that decides anything, so there must be exactly
 * one copy of it: the organiser preview on /admin/tally and the real count the
 * Worker runs are the same function over the same rows.
 */

export interface Ballot {
  id: string
  /**
   * SHA-256 of the voter's ticket ID and email, hashed in their browser.
   * See apps/web/src/lib/hash.ts `voterIdHash` - the normative definition.
   */
  voter_hash: string
  talk_ids: string[]
  /** When this ballot was cast. Never overwritten; a change of mind appends. */
  cast_at: number
}

/** A ballot row as D1 stores it: talk_ids is a JSON array in a TEXT column. */
export interface BallotRow {
  id: string
  conference_id: string
  voter_hash: string
  talk_ids: string
  cast_at: number
}

export function parseBallotRow(row: BallotRow): Ballot {
  let talkIds: string[] = []
  try {
    const parsed: unknown = JSON.parse(row.talk_ids)
    if (Array.isArray(parsed)) talkIds = parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    // A ballot we cannot read is a ballot we cannot count, but it must not take
    // the whole tally down with it. It stays in the log for anyone auditing.
  }
  return { id: row.id, voter_hash: row.voter_hash, talk_ids: talkIds, cast_at: row.cast_at }
}

export interface TallySummary {
  ballots_cast: number
  from_unknown_tickets: number
  superseded: number
  counted: number
  /** Null until an official ticket list has been loaded. */
  eligible_tickets: number | null
}

/**
 * The whole voting model in one function.
 *
 * Ballots are accepted from anyone without checking the ticket, so nothing is
 * decided until here: drop ballots whose hash is not on the official list, then
 * keep only the latest ballot from each remaining voter. With no list loaded,
 * every ballot counts - which is what the live results show while voting runs.
 *
 * `ballots` must arrive oldest first. Two ballots from one voter can share a
 * cast_at - the Workers runtime holds the clock still between I/O, so a fast
 * re-submission really can land on the same millisecond - and a timestamp alone
 * cannot order those. The caller's order breaks the tie, and every caller reads
 * them back in insertion order, so the later submission wins. Preferring the
 * earlier one would leave a voter's correction uncounted.
 */
export function tallyBallots(
  ballots: Ballot[],
  validVoterHashes: Iterable<string>
): { ballots: Ballot[]; summary: TallySummary } {
  const valid = new Set(validVoterHashes)
  const hasList = valid.size > 0

  const known = hasList ? ballots.filter(b => valid.has(b.voter_hash)) : ballots

  const latestByVoter = new Map<string, Ballot>()
  for (const ballot of known) {
    const current = latestByVoter.get(ballot.voter_hash)
    // >= not >, so that on an equal cast_at the one later in the list wins.
    if (!current || ballot.cast_at >= current.cast_at) latestByVoter.set(ballot.voter_hash, ballot)
  }

  const counted = [...latestByVoter.values()]
  return {
    ballots: counted,
    summary: {
      ballots_cast: ballots.length,
      from_unknown_tickets: ballots.length - known.length,
      superseded: known.length - counted.length,
      counted: counted.length,
      eligible_tickets: hasList ? valid.size : null,
    },
  }
}

/** Votes per talk id, from already-tallied ballots. Unknown ids are ignored. */
export function countVotes(ballots: Ballot[], talkIds: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const id of talkIds) counts.set(id, 0)
  for (const ballot of ballots) {
    for (const talkId of ballot.talk_ids) {
      const current = counts.get(talkId)
      if (current !== undefined) counts.set(talkId, current + 1)
    }
  }
  return counts
}

/** Competition ranking: equal vote totals share a rank, and the next rank skips. */
export function rankTalks<T extends { vote_count: number }>(talks: T[]): Array<T & { rank: number }> {
  let previousVotes: number | undefined
  let previousRank = 0
  return talks.map((talk, index) => {
    const rank = talk.vote_count === previousVotes ? previousRank : index + 1
    previousVotes = talk.vote_count
    previousRank = rank
    return { ...talk, rank }
  })
}

export type Placing = 'selected' | 'tie-break' | 'out'

/**
 * Who is actually on stage.
 *
 * Rank alone cannot say. A three-way tie at rank 6 puts eight talks at
 * "rank <= 7", and there are only seven slots. A talk is selected only if
 * everyone ahead of it plus its whole tie group fits; a tie straddling the
 * cutoff is undecided until an organiser breaks it.
 */
export function placings<T extends { vote_count: number }>(talks: T[], slots: number): Placing[] {
  return talks.map(talk => {
    const ahead = talks.filter(t => t.vote_count > talk.vote_count).length
    const tied = talks.filter(t => t.vote_count === talk.vote_count).length
    if (ahead + tied <= slots) return 'selected'
    return ahead < slots ? 'tie-break' : 'out'
  })
}
