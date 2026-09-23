import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { clearAdminPassword, useAdminMode } from './lib/admin.js'
import { EVENT } from './lib/event.js'
import AdminGate from './components/AdminGate.js'
import LandingPage from './pages/LandingPage.js'
import VotePage from './pages/VotePage.js'
import PublicResultsPage from './pages/PublicResultsPage.js'
import ConferencePage from './pages/admin/ConferencePage.js'
import TalksPage from './pages/admin/TalksPage.js'
import ResultsPage from './pages/admin/ResultsPage.js'
import TallyPage from './pages/admin/TallyPage.js'

const ADMIN_NAV = [
  { to: '/admin/conference', label: 'Setup' },
  { to: '/admin/talks', label: 'Proposals' },
  { to: '/admin/results', label: 'Results' },
  { to: '/admin/tally', label: 'Tally' },
]

/**
 * The lockup: the IndiaFOSS 2026 wordmark, the event, and what this site IS.
 *
 * "Voting System" is load-bearing. Without it, the festival's logo next to the
 * event name reads as the official fossunited.org page, and this is not that:
 * it is an independent tool run by Absurd Industries (see the footer). Stacked on two
 * lines so the full label still fits beside the Vote button on a phone.
 */
function Wordmark() {
  return (
    <Link
      to="/"
      className="flex min-w-0 shrink-0 items-center gap-2.5"
      aria-label={`${EVENT.name} Voting System home`}
    >
      <img
        src="/images/indiafoss-wordmark.svg"
        alt={EVENT.conference}
        className="h-5 w-auto shrink-0"
        width={56}
        height={20}
      />
      <span aria-hidden="true" className="h-7 w-px shrink-0 bg-line" />
      <span className="flex flex-col leading-none">
        <span className="font-sans text-[0.95rem] font-bold tracking-tight text-ink">
          {EVENT.name}
        </span>
        <span className="mt-1 font-sans text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Voting System
        </span>
      </span>
    </Link>
  )
}

function Header() {
  const isAdmin = useAdminMode()
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface-sunken/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Wordmark />
          {isAdmin && (
            <nav className="scrollbar-hide flex min-w-0 gap-0.5 overflow-x-auto" aria-label="Organiser">
              {ADMIN_NAV.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-link shrink-0 ${pathname === item.to ? 'nav-link-active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={clearAdminPassword}
              className="btn-ghost btn-sm hidden sm:inline-flex"
              title="Forget the organiser password on this device"
            >
              Lock
            </button>
          )}
          <Link
            to="/vote"
            className={`btn btn-sm ${pathname === '/vote' ? 'btn-outline' : 'btn-primary'}`}
          >
            Vote
          </Link>
        </div>
      </div>
    </header>
  )
}

/**
 * On every page, not just the landing page: the ticket gate is where trust is
 * decided, and it is the page people land on from a shared link.
 *
 * Three things a voter should be able to find without asking: who runs this
 * (not FOSS United), what happens to their details (nothing leaves the
 * browser), and where the borrowed content came from (credited, CC BY-SA).
 */
function Footer() {
  const link = 'font-medium text-ink underline underline-offset-2 hover:text-accent-ink'
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 text-sm leading-relaxed text-ink-faint sm:px-6">
        <p>
          {EVENT.name} is part of {EVENT.conference}, organised by FOSS United. This voting
          system is run by{' '}
          <a
            href={EVENT.links.operator}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ink underline underline-offset-2 hover:text-accent-ink"
          >
            {EVENT.operator}
          </a>
          ,
          an independent community.
        </p>
        <p className="flex gap-2">
          <i className="ph-bold ph-lock-simple mt-1 shrink-0 text-ink" aria-hidden="true" />
          <span>
            Your ticket ID and email never leave your browser. We only ever receive an
            anonymous hash, so there’s no personal data to share.
          </span>
        </p>
        <p>
          Event details and talk proposals are from{' '}
          <a href={EVENT.links.event} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
            FOSS United’s {EVENT.name} page
          </a>
          , used under CC BY-SA.
          {/* No version on purpose: the source says "CC-BY-SA" and nothing more.
              Linking a specific deed would claim a version it never stated. */}
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1 pt-1">
          <a href={EVENT.links.event} target="_blank" rel="noreferrer" className={link}>
            Official event page
            <i className="ph ph-arrow-up-right ml-1" aria-hidden="true" />
          </a>
          <a href={EVENT.links.source} target="_blank" rel="noreferrer" className={link}>
            Source code
            <i className="ph ph-arrow-up-right ml-1" aria-hidden="true" />
          </a>
        </p>
      </div>
    </footer>
  )
}

export default function App() {
  const adminOnly = (element: React.ReactNode) => <AdminGate>{element}</AdminGate>

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/vote" element={<VotePage />} />
          <Route path="/results" element={<PublicResultsPage />} />
          <Route path="/admin/conference" element={adminOnly(<ConferencePage />)} />
          <Route path="/admin/talks" element={adminOnly(<TalksPage />)} />
          <Route path="/admin/results" element={adminOnly(<ResultsPage />)} />
          <Route path="/admin/tally" element={adminOnly(<TallyPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
