import { apiFetch } from './api.js'

/**
 * Cast a ballot.
 *
 * BACKEND TODO - the contract this is standing in for:
 *
 *   POST /api/ballots
 *   { voter_hash: string, talk_ids: string[] }
 *
 *   voter_hash = SHA256_hex( upper(trim(ticket)) + "+" + lower(trim(email)) ),
 *   computed in the browser - see lib/hash.ts `voterIdHash`, which is the
 *   normative definition. The server never sees the ticket or the email, so it
 *   could not validate them even if it wanted to.
 *
 *   - Accept without validating. The response must not differ between a real
 *     pair and a made-up one: same status, same body, same timing. Anything
 *     else turns the vote page into an oracle for enumerating attendees.
 *   - Append-only. A voter changing their mind writes a NEW row, with its own
 *     cast_at timestamp; nothing is updated and nothing is deleted. The log of
 *     what was submitted when is the audit trail.
 *   - Tallying happens later, against the official list of claimed tickets:
 *     hash each (ticket, email) pair the same way, drop ballots whose voter_hash
 *     is not among them, keep the latest ballot per remaining hash. See
 *     src/mock/store.ts `tally` for the reference implementation, and
 *     /admin/tally for it running.
 *
 * Until that endpoint exists, this writes to the local demo store.
 */
export async function submitBallot(voterHash: string, talkIds: string[]): Promise<void> {
  await apiFetch('/api/ballots', {
    method: 'POST',
    body: JSON.stringify({ voter_hash: voterHash, talk_ids: talkIds }),
  })
}
