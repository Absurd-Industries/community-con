import type { Conference, Talk } from '@cc/db'
import { EVENT, SCHEDULE } from '../lib/event.js'

/**
 * Demo data for the design preview.
 *
 * The event details are real (see lib/event.ts). Every proposal, speaker,
 * ticket ID and email address below is invented - the CFP had not opened when
 * this was written. Swap this file for a real export when there is one; nothing
 * else reads it.
 */

export const CONFERENCE_ID = 'conf_communi_con_2026'

/** Flash-talk slots on the day. Also the vote budget: one vote per slot. */
export const SLOT_COUNT = EVENT.slotCount

/** Minutes per talk. No Q&A. */
const SLOT_MINUTES = EVENT.slotMinutes

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
      'Ten minutes, one Pi, and a working BGP-speaking edge router. What breaks first, what breaks worst, and why the answer is almost always the SD card.',
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
      'Contributor licence agreements are sold as risk management and usually bought as a moat. Ten minutes on what a DCO gets you instead, and when a CLA is genuinely the right call.',
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
 * A claimed ticket: the ID, and the address it was claimed with.
 *
 * Neither half identifies a participant on its own. The ticketing system pairs
 * them at claim time and refuses to bind one email to several tickets, so the
 * PAIR is the identity - which is what gets hashed. See lib/hash.ts.
 */
export interface VoterPair {
  ticket: string
  email: string
}

/**
 * Pairs that have cast a ballot in the seeded data.
 *
 * The last four deliberately do NOT appear in DEMO_OFFICIAL_PAIRS - they stand
 * in for votes cast with a made-up, refunded or unclaimed ticket, which is
 * exactly what the tally is supposed to discard.
 */
export const DEMO_CAST_PAIRS: VoterPair[] = [
  { ticket: '9dzq76', email: 'meera.raghunathan@example.com' },
  { ticket: '59v24c', email: 'anirban.dasgupta@example.org' },
  { ticket: 'e4mm86', email: 'fatima.sheikh@example.com' },
  { ticket: 'q9s4tj', email: 'karthik.v@example.com' },
  { ticket: 'wa2ugj', email: 'sreelakshmi.nair@example.org' },
  { ticket: 'e93pat', email: 'devendra.pawar@example.com' },
  { ticket: 'tkhjn5', email: 'ritu.malhotra@example.com' },
  { ticket: 'q8dnyf', email: 'joseph.mathew@example.org' },
  { ticket: 'e2edtg', email: 'aditi.kulkarni@example.com' },
  { ticket: '5kqd46', email: 'imnainla.jamir@example.com' },
  { ticket: 'stc33d', email: 'pranav.iyer@example.org' },
  { ticket: 'e62jmb', email: 'shalini.bose@example.com' },
  { ticket: 'tyfck9', email: 'bhaskar.saikia@example.com' },
  { ticket: 'vadh8z', email: 'tanvi.deshmukh@example.org' },
  { ticket: '5jpuzg', email: 'nikhil.rao@example.com' },
  { ticket: 'ph7yac', email: 'priya.menon@example.com' },
  { ticket: 'pz4jzg', email: 'arjun.shetty@example.org' },
  { ticket: 'rkrecv', email: 'zainab.qureshi@example.com' },
  { ticket: '9bfqjh', email: 'rohan.gupta@example.com' },
  { ticket: '3b6thr', email: 'divya.krishnan@example.org' },
  { ticket: 'd32qus', email: 'sandeep.yadav@example.com' },
  { ticket: 'cyrauy', email: 'lakshmi.prasad@example.com' },
  { ticket: '7d9q4n', email: 'faisal.rahman@example.org' },
  { ticket: '6eddnw', email: 'neha.bhatt@example.com' },
  { ticket: '3srsv3', email: 'vivek.nambiar@example.com' },
  { ticket: 'h42jsa', email: 'ananya.sarkar@example.org' },
  { ticket: 'dkxhdb', email: 'gurpreet.singh@example.com' },
  { ticket: 'fq4kek', email: 'kavya.reddy@example.com' },
  { ticket: 'ywpf8j', email: 'tenzin.norbu@example.org' },
  { ticket: 'hegrc3', email: 'siddharth.jain@example.com' },

  // Not on the official list - discarded at tally time.
  { ticket: 'aaaaaa', email: 'nobody@example.com' },
  { ticket: 'abc123', email: 'someone.else@example.org' },
  { ticket: 'zzzzzz', email: 'guessing@example.com' },
  { ticket: 'qwerty', email: 'not.even.trying@example.com' },

  /**
   * The same person as the very first entry, typed differently on their second
   * visit: capitalised email, uppercase ticket, stray spaces either side. Normalisation
   * in `voterIdHash` collapses this to one voter - so the tally shows it as a
   * superseded ballot, not a second one. Remove this and the demo silently
   * double-counts them, which is the bug the normalisation exists to prevent.
   */
  { ticket: ' 9DZQ76 ', email: 'Meera.Raghunathan@Example.COM' },
]

/**
 * The official list of claimed tickets, as an organiser would export it and
 * paste into the tally page.
 */
export const DEMO_OFFICIAL_PAIRS: VoterPair[] = [
  ...DEMO_CAST_PAIRS.slice(0, 30),
  // Ticket-holders who never voted. Turnout should reflect them.
  { ticket: 'fj6cec', email: 'harini.balaji@example.com' },
  { ticket: 'f77jke', email: 'omar.farooq@example.org' },
  { ticket: 'yv2y2k', email: 'sneha.pillai@example.com' },
  { ticket: 'bjvp2u', email: 'rajat.kapoor@example.com' },
  { ticket: '4b9dad', email: 'ishita.ghosh@example.org' },
  { ticket: 'xjrdda', email: 'mahesh.kulkarni@example.com' },
  { ticket: 'ddnsk5', email: 'ayesha.khan@example.com' },
  { ticket: 'me932q', email: 'dinesh.kumar@example.org' },
  { ticket: 'qdz26f', email: 'pooja.shenoy@example.com' },
  { ticket: 'zgf9a8', email: 'abhishek.das@example.com' },
]

/** The sample list, in the CSV shape the tally page parses. */
export const DEMO_OFFICIAL_CSV = [
  'ticket_id,email',
  ...DEMO_OFFICIAL_PAIRS.map(pair => `${pair.ticket},${pair.email}`),
].join('\n')

export function seedConference(): Conference {
  return {
    id: CONFERENCE_ID,
    name: EVENT.name,
    // Voting-first on purpose. The event's own tagline belongs to the official
    // page; leading with it here is what made this site read like a copy of it.
    description:
      `Talks proposed by the community, chosen by ${EVENT.conference} ticket holders. ` +
      `The top ${SLOT_COUNT} go on stage in ${EVENT.hall}.`,
    voting_opens_at: SCHEDULE.votingOpensAt,
    voting_closes_at: SCHEDULE.votingClosesAt,
    voting_force_status: 'scheduled',
    votes_per_voter: SLOT_COUNT,
    results_public: 0,
    speaker_visibility: 'basic',
    // The ballot locks when voting opens; before that it is still editable.
    ballot_locked_at: null,
    ballot_talk_count: null,
    created_at: SCHEDULE.cfpOpensAt,
  }
}

export function seedTalks(): Talk[] {
  // Spread submissions across the real CFP window, newest first.
  const window = SCHEDULE.cfpClosesAt - SCHEDULE.cfpOpensAt
  const step = window / (TALKS.length + 1)

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
    created_at: Math.round(SCHEDULE.cfpClosesAt - (index + 1) * step),
  }))
}
