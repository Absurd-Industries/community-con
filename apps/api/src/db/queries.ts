import {
  countVotes,
  parseBallotRow,
  tallyBallots,
  type Ballot,
  type BallotRow,
  type Conference,
  type Talk,
  type TallySummary,
} from '@cc/db'

export async function getConference(db: D1Database) {
  return db.prepare('SELECT * FROM conferences ORDER BY created_at DESC LIMIT 1').first<Conference>()
}

export async function getTalksByConference(db: D1Database, conferenceId: string) {
  return db.prepare(
    'SELECT * FROM talks WHERE conference_id = ? ORDER BY created_at DESC'
  ).bind(conferenceId).all<Talk>()
}

export async function getEligibleTalkCount(db: D1Database, conferenceId: string) {
  const result = await db.prepare(
    'SELECT COUNT(*) as count FROM talks WHERE conference_id = ? AND withdrawn_at IS NULL'
  ).bind(conferenceId).first<{ count: number }>()
  return result?.count ?? 0
}

export interface TalkWithVotes extends Talk {
  vote_count: number
}

export interface TallyResult {
  talks: TalkWithVotes[]
  /** The ballots that survived the rule - one per voter, latest only. */
  counted: Ballot[]
  summary: TallySummary
}

/**
 * Read the ballots and count them.
 *
 * Counting is not a SQL GROUP BY here, and cannot be: which ballots count
 * depends on the official ticket list and on which ballot from each voter came
 * last. That rule lives in @cc/db `tallyBallots`, shared with the browser, so
 * the organiser's preview and this can never disagree. At a few thousand
 * ballots, reading them all into the Worker costs nothing worth optimising.
 */
export async function tallyConference(db: D1Database, conferenceId: string): Promise<TallyResult> {
  const [talkRows, ballotRows, voterRows] = await Promise.all([
    db.prepare('SELECT * FROM talks WHERE conference_id = ? ORDER BY created_at DESC')
      .bind(conferenceId).all<Talk>(),
    db.prepare('SELECT * FROM ballots WHERE conference_id = ? ORDER BY cast_at ASC, rowid ASC')
      .bind(conferenceId).all<BallotRow>(),
    db.prepare('SELECT voter_hash FROM valid_voters WHERE conference_id = ?')
      .bind(conferenceId).all<{ voter_hash: string }>(),
  ])

  const talks = talkRows.results
  const ballots = ballotRows.results.map(parseBallotRow)
  const { ballots: counted, summary } = tallyBallots(
    ballots,
    voterRows.results.map(row => row.voter_hash)
  )
  const counts = countVotes(counted, talks.map(talk => talk.id))

  return {
    talks: talks
      .map(talk => ({ ...talk, vote_count: counts.get(talk.id) ?? 0 }))
      .sort((a, b) => b.vote_count - a.vote_count || b.created_at - a.created_at),
    counted,
    summary,
  }
}

export function voteStats(result: TallyResult) {
  return {
    // Before an official ticket list is loaded there is no denominator, so fall
    // back to "everyone who voted" rather than inventing a turnout figure.
    eligible_voters: result.summary.eligible_tickets ?? result.counted.length,
    participating_voters: result.counted.length,
    total_votes: result.counted.reduce((sum, ballot) => sum + ballot.talk_ids.length, 0),
  }
}
