import type { Conference, Talk } from '@cc/db'

/**
 * Demo data for the design preview.
 *
 * Every proposal, speaker and ticket ID below is invented. Swap this file for a
 * real CSV export when there is one - nothing else reads it.
 */

export const CONFERENCE_ID = 'conf_community_con_2026'

/** Flash-talk slots on the day. Also the vote budget: one vote per slot. */
export const SLOT_COUNT = 6

/** Minutes per flash talk. */
const SLOT_MINUTES = 5

interface SeedTalk {
  title: string
  presenter: string
  bio: string
  track: string
  pitch: string
}

const TALKS: SeedTalk[] = [
  {
    title: 'Your Raspberry Pi is a router now',
    presenter: 'Meera Raghunathan',
    bio: 'Network engineer. Runs a small WISP in the Nilgiris.',
    track: 'Infrastructure',
    pitch:
      'Five minutes, one Pi, and a working BGP-speaking edge router. What breaks first, what breaks worst, and why the answer is almost always the SD card.',
  },
  {
    title: "I read the kernel's RNG so you don't have to",
    presenter: 'Anirban Dasgupta',
    bio: 'Security researcher, occasional kernel janitor.',
    track: 'Deep dive',
    pitch:
      'A tour of drivers/char/random.c after the 2022 rewrite: what entropy actually means here, why the old debate about /dev/random vs /dev/urandom finally ended, and what still surprises people.',
  },
  {
    title: 'Packaging Python for Debian in 2026: still hard, still worth it',
    presenter: 'Fatima Sheikh',
    bio: 'Debian Developer since 2019.',
    track: 'Tooling',
    pitch:
      'pyproject.toml won. Debian packaging did not get easier. A short, honest account of the gap and the three tools that close most of it.',
  },
  {
    title: 'A tiny CRDT in 200 lines of Rust',
    presenter: 'Karthik Venkatesan',
    bio: 'Builds collaborative editors. Mostly for fun.',
    track: 'Deep dive',
    pitch:
      'Live-coded from an empty file: a last-writer-wins map that actually converges. No dependencies, no hand-waving, and a demo with two laptops on airplane mode.',
  },
  {
    title: 'How we got 40,000 school students onto FOSS in Kerala',
    presenter: 'Sreelakshmi Nair',
    bio: 'Teacher trainer with the state IT@School programme.',
    track: 'Community',
    pitch:
      'The logistics nobody writes blog posts about: hardware refresh cycles, teacher buy-in, exam board sign-off, and what happened in year three when the budget changed.',
  },
  {
    title: 'Reverse-engineering my electricity meter with an RTL-SDR',
    presenter: 'Devendra Pawar',
    bio: 'Hardware hacker. Has voided many warranties.',
    track: 'Hardware',
    pitch:
      'The meter broadcasts in the clear. Here is the capture, the protocol, the Python, and the very awkward email I sent the utility afterwards.',
  },
  {
    title: 'Postgres full-text search is enough',
    presenter: 'Ritu Malhotra',
    bio: 'Backend engineer. Has deleted two Elasticsearch clusters.',
    track: 'Tooling',
    pitch:
      'tsvector, GIN indexes, and trigram similarity get you further than the search-service vendors would like you to believe. Where the wall actually is, with numbers.',
  },
  {
    title: "The case against your company's CLA",
    presenter: 'Joseph Mathew',
    bio: 'Lawyer. Reformed. Now writes about licensing.',
    track: 'Policy',
    pitch:
      'Contributor licence agreements are sold as risk management and usually bought as a moat. Five minutes on what a DCO gets you instead, and when a CLA is genuinely the right call.',
  },
  {
    title: 'Typesetting Devanagari properly: a bug report in three acts',
    presenter: 'Aditi Kulkarni',
    bio: 'Type designer and reluctant font-shaping expert.',
    track: 'Deep dive',
    pitch:
      'A conjunct rendered wrong in one renderer and right in three others. The trail runs through HarfBuzz, an OpenType spec ambiguity, and a nineteenth-century metal type sample.',
  },
  {
    title: 'Running an ISP out of a village in Nagaland',
    presenter: 'Imnainla Jamir',
    bio: 'Co-founder of a community network operator.',
    track: 'Infrastructure',
    pitch:
      'Four years, 900 subscribers, one very long fibre run, and a regulatory regime that did not anticipate us. What community networks need from the rest of the FOSS world.',
  },
  {
    title: 'SQLite is a filesystem now',
    presenter: 'Pranav Iyer',
    bio: 'Writes storage engines. Sleeps rarely.',
    track: 'Deep dive',
    pitch:
      'Blobs, WAL mode, and the VFS layer add up to something that behaves a lot like a filesystem with transactions. A demo, and an honest list of the places this idea falls over.',
  },
  {
    title: 'What I learnt maintaining a package nobody uses',
    presenter: 'Shalini Bose',
    bio: 'Maintainer of a library with 11 stars and 4 million downloads.',
    track: 'Community',
    pitch:
      'Eight years of a dependency that everyone has and nobody thinks about. On invisible infrastructure, burnout, and the one email that made it worth it.',
  },
  {
    title: 'OpenStreetMap for flood mapping in Assam',
    presenter: 'Bhaskar Saikia',
    bio: 'Geospatial analyst working with disaster response teams.',
    track: 'Community',
    pitch:
      'Mapping parties before the monsoon, and what the data actually does once the water arrives. Includes the parts that did not work.',
  },
  {
    title: 'Making my thesis reproducible with Nix',
    presenter: 'Tanvi Deshmukh',
    bio: 'PhD student. Fought the build system and won, eventually.',
    track: 'Tooling',
    pitch:
      'Six years of analysis scripts, one flake.nix, and a clean rebuild from scratch on a machine that had never seen the project. What it cost and what it saved.',
  },
]

/**
 * Ticket IDs that have cast a ballot in the seeded data.
 *
 * Some of these deliberately do NOT appear in DEMO_VALID_TICKETS - they stand in
 * for votes cast with a made-up or refunded ticket, which is exactly what the
 * tally is supposed to discard.
 */
export const DEMO_CAST_TICKETS: string[] = [
  'IF26-4821', 'IF26-1170', 'IF26-9034', 'IF26-2265', 'IF26-7712',
  'IF26-3398', 'IF26-8846', 'IF26-5501', 'IF26-6627', 'IF26-1093',
  'IF26-4450', 'IF26-2984', 'IF26-7136', 'IF26-3357', 'IF26-9902',
  'IF26-6018', 'IF26-8273', 'IF26-1544', 'IF26-5860', 'IF26-2411',
  'IF26-7799', 'IF26-3082', 'IF26-4635', 'IF26-9147', 'IF26-6390',
  'IF26-1826', 'IF26-8504', 'IF26-2758', 'IF26-5219', 'IF26-7043',
  // Not on the official list - these get discarded at tally time.
  'IF26-0001', 'IF26-0002', 'IF26-9999', 'ABCD-1234',
]

/** The "official" ticket list an organiser would paste into the tally page. */
export const DEMO_VALID_TICKETS: string[] = [
  ...DEMO_CAST_TICKETS.slice(0, 30),
  // Ticket-holders who never voted. Turnout should reflect them.
  'IF26-3741', 'IF26-8195', 'IF26-2606', 'IF26-5478', 'IF26-9320',
  'IF26-1259', 'IF26-6884', 'IF26-4067', 'IF26-7512', 'IF26-3930',
]

export function seedConference(now: number): Conference {
  const HOUR = 60 * 60 * 1000
  return {
    id: CONFERENCE_ID,
    name: 'Community Con',
    description:
      'The flash lightning-talk hour at IndiaFOSS 2026, programmed by the people in the room. ' +
      `Proposals closed at the end of day one; the top ${SLOT_COUNT} take the stage after lunch on day two.`,
    // Anchored to load time so the demo is never stale: voting opened two hours
    // ago and closes tomorrow morning.
    voting_opens_at: now - 2 * HOUR,
    voting_closes_at: now + 20 * HOUR,
    voting_force_status: 'scheduled',
    votes_per_voter: SLOT_COUNT,
    results_public: 0,
    speaker_visibility: 'basic',
    ballot_locked_at: now - 2 * HOUR,
    ballot_talk_count: TALKS.length,
    created_at: now - 72 * HOUR,
  }
}

export function seedTalks(now: number): Talk[] {
  const HOUR = 60 * 60 * 1000
  return TALKS.map((talk, index) => ({
    id: `talk_${String(index + 1).padStart(2, '0')}`,
    conference_id: CONFERENCE_ID,
    title: talk.title,
    description: talk.pitch,
    duration_minutes: SLOT_MINUTES,
    presenter_name: talk.presenter,
    presenter_bio: talk.bio,
    presenter_email: null,
    talk_type: talk.track,
    cfp_url: null,
    cfp_content: null,
    references: null,
    withdrawn_at: null,
    withdrawal_reason: null,
    // Spread submissions across the day-one CFP window, newest first.
    created_at: now - (26 + index) * HOUR,
  }))
}

