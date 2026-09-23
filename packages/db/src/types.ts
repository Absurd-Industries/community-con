export type SpeakerVisibility = 'hidden' | 'basic' | 'full'

export interface Conference {
  id: string
  name: string
  description: string | null
  voting_opens_at: number | null
  voting_closes_at: number | null
  voting_force_status: 'open' | 'closed' | 'scheduled'
  votes_per_voter: number
  results_public: 0 | 1
  speaker_visibility: SpeakerVisibility
  ballot_locked_at: number | null
  ballot_talk_count: number | null
  created_at: number
}

export interface Talk {
  id: string
  conference_id: string
  title: string
  description: string | null
  duration_minutes: number
  presenter_name: string
  presenter_bio: string | null
  presenter_email: string | null
  talk_type: string | null
  cfp_url: string | null
  cfp_content: string | null
  references: string | null
  withdrawn_at: number | null
  withdrawal_reason: string | null
  created_at: number
}

export interface OrganizerTieBreak {
  id: string
  conference_id: string
  selected_talk_id: string
  tied_talk_ids: string
  reason: string
  admin_label: string
  created_at: number
}

export interface AuditLog {
  id: string
  admin_label: string
  action: string
  target_type: string
  target_id: string | null
  details: string | null
  created_at: number
}
