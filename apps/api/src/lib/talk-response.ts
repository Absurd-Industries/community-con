import type { SpeakerVisibility, Talk } from '@cc/db'

export type PublicTalk = Pick<Talk,
  'id' | 'title' | 'description' | 'talk_type' | 'references' | 'withdrawn_at' | 'withdrawal_reason'
> & {
  presenter_name?: string
  presenter_bio?: string | null
  cfp_url?: string | null
  vote_count?: number
  rank?: number
}

export function serializePublicTalk(
  talk: Talk & { vote_count?: number; rank?: number },
  visibility: SpeakerVisibility,
): PublicTalk {
  const result: PublicTalk = {
    id: talk.id,
    title: talk.title,
    description: talk.description,
    talk_type: talk.talk_type,
    references: talk.references,
    withdrawn_at: talk.withdrawn_at,
    withdrawal_reason: talk.withdrawal_reason,
  }

  if (visibility !== 'hidden') result.presenter_name = talk.presenter_name
  if (visibility === 'full') {
    result.presenter_bio = talk.presenter_bio
    result.cfp_url = talk.cfp_url
  }
  if (talk.vote_count !== undefined) result.vote_count = talk.vote_count
  if (talk.rank !== undefined) result.rank = talk.rank

  return result
}
