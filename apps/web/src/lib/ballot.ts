import { apiFetch } from './api.js'

/**
 * Cast a ballot.
 *
 * BACKEND TODO - the contract this is standing in for:
 *
 *   POST /api/ballots
 *   { ticket_hash: string, talk_ids: string[] }
 *
 *   - Accept without validating the ticket. The response must not differ
 *     between a real ticket and a made-up one: same status, same body, same
 *     timing. Anything else turns the vote page into a ticket oracle.
 *   - Append-only. A voter changing their mind writes a new row; nothing is
 *     updated or deleted.
 *   - Tallying happens later, against the official ticket list: keep the latest
 *     ballot per valid ticket, discard the rest. See src/mock/store.ts `tally`
 *     for the reference implementation, and /admin/tally for it running.
 *
 * Until that endpoint exists, this writes to the local demo store.
 */
export async function submitBallot(ticketHash: string, talkIds: string[]): Promise<void> {
  await apiFetch('/api/ballots', {
    method: 'POST',
    body: JSON.stringify({ ticket_hash: ticketHash, talk_ids: talkIds }),
  })
}
