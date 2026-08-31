import type { Conference, SlotType, Talk, Vote } from '@cc/db'

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

export async function getTalksWithVoteCounts(db: D1Database, conferenceId: string) {
  return db.prepare(`
    SELECT t.*, COUNT(v.id) as vote_count
    FROM talks t
    LEFT JOIN votes v ON v.talk_id = t.id
    WHERE t.conference_id = ?
    GROUP BY t.id
    ORDER BY vote_count DESC, t.created_at DESC
  `).bind(conferenceId).all<Talk & { vote_count: number }>()
}

export async function getSlotTypes(db: D1Database, conferenceId: string) {
  return db.prepare(
    'SELECT * FROM slot_types WHERE conference_id = ? ORDER BY duration_minutes'
  ).bind(conferenceId).all<SlotType>()
}

export async function getVoterVotes(db: D1Database, voterId: string, conferenceId: string) {
  return db.prepare(`
    SELECT v.*
    FROM votes v
    INNER JOIN talks t ON t.id = v.talk_id
    WHERE v.voter_id = ? AND t.conference_id = ?
  `).bind(voterId, conferenceId).all<Vote>()
}

export async function getVoteCount(db: D1Database, voterId: string, conferenceId: string) {
  const result = await db.prepare(
    `SELECT COUNT(*) as count
     FROM votes v
     INNER JOIN talks t ON t.id = v.talk_id
     WHERE v.voter_id = ? AND t.conference_id = ?`
  ).bind(voterId, conferenceId).first<{ count: number }>()
  return result?.count ?? 0
}

export async function getVoteStats(db: D1Database, conferenceId: string) {
  const voterCount = await db.prepare(
    'SELECT COUNT(*) as count FROM voters'
  ).first<{ count: number }>()

  const participatingVoterCount = await db.prepare(`
    SELECT COUNT(DISTINCT v.voter_id) as count
    FROM votes v
    INNER JOIN talks t ON t.id = v.talk_id
    WHERE t.conference_id = ?
  `).bind(conferenceId).first<{ count: number }>()

  const voteCount = await db.prepare(`
    SELECT COUNT(*) as count
    FROM votes v
    INNER JOIN talks t ON t.id = v.talk_id
    WHERE t.conference_id = ?
  `).bind(conferenceId).first<{ count: number }>()

  return {
    eligible_voters: voterCount?.count ?? 0,
    participating_voters: participatingVoterCount?.count ?? 0,
    total_votes: voteCount?.count ?? 0,
  }
}
