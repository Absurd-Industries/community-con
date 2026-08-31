import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { useAdminMode } from './lib/admin.js'
import DemoBar from './components/DemoBar.js'
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

function Wordmark() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2 font-sans text-[0.95rem] font-bold tracking-tight text-ink"
      aria-label="Community Con home"
    >
      <span
        aria-hidden="true"
        className="grid h-6 w-6 place-items-center rounded-md bg-ink text-[0.7rem] text-surface"
      >
        <i className="ph-bold ph-check" />
      </span>
      Community Con
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
          {isAdmin && <span className="tag tag-muted hidden sm:inline-flex">Organiser view</span>}
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

/** Shown when an organiser route is opened without admin mode on. */
function AdminOff() {
  return (
    <div className="empty-state">
      <i className="ph ph-lock-simple text-3xl opacity-40" aria-hidden="true" />
      <p className="section-title text-ink">Organiser view is off</p>
      <p className="max-w-sm text-sm">
        Turn on <strong className="font-semibold text-ink">Organiser view</strong> in the demo
        panel to see the setup, proposal, results and tally screens.
      </p>
    </div>
  )
}

export default function App() {
  const isAdmin = useAdminMode()

  const adminOnly = (element: React.ReactNode) => (isAdmin ? element : <AdminOff />)

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
      <DemoBar />
    </div>
  )
}
