export interface Reference {
  title?: string | null
  url: string
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1) || null
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null
    }
  } catch {
    /* ignore */
  }
  return null
}

function repoInfo(url: string): { host: 'github' | 'gitlab'; slug: string } | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const kind = host === 'github.com' ? 'github' : host === 'gitlab.com' ? 'gitlab' : null
    if (!kind) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null // org/user root, not a repo - treat as generic
    // skip non-repo paths
    if (['orgs', 'sponsors', 'topics', 'about'].includes(parts[0])) return null
    return { host: kind, slug: `${parts[0]}/${parts[1]}` }
  } catch {
    return null
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function faviconFor(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainOf(url))}&sz=64`
}

function YouTubeEmbed({ id, title }: { id: string; title?: string | null }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink/12 bg-ink/5">
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title={title || 'YouTube video'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {title && <p className="truncate px-3 py-2 text-xs text-ink-faint">{title}</p>}
    </div>
  )
}

function RepoCard({ reference: r, repo }: { reference: Reference; repo: { host: 'github' | 'gitlab'; slug: string } }) {
  const icon = repo.host === 'github' ? 'ph-github-logo' : 'ph-gitlab-logo-simple'
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noreferrer"
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-ink/12 bg-surface-sunken px-4 py-3 transition-colors hover:border-ink/30 hover:bg-surface-sunken"
    >
      <i className={`ph-fill ${icon} text-2xl text-ink`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm font-semibold text-ink group-hover:text-black">
          {repo.slug}
        </span>
        <span className="block text-xs text-ink-faint">
          {repo.host === 'github' ? 'GitHub' : 'GitLab'} repository
        </span>
      </span>
      <i className="ph-bold ph-arrow-square-out text-ink-faint transition-colors group-hover:text-black" aria-hidden="true" />
    </a>
  )
}

function LinkCard({ reference: r }: { reference: Reference }) {
  const domain = domainOf(r.url)
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noreferrer"
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-ink/12 bg-surface-sunken px-4 py-3 transition-colors hover:border-ink/30 hover:bg-surface-sunken"
    >
      <img
        src={faviconFor(r.url)}
        alt=""
        width={20}
        height={20}
        className="h-5 w-5 shrink-0 rounded"
        loading="lazy"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink group-hover:text-black">
          {r.title?.trim() || domain}
        </span>
        <span className="block truncate text-xs text-ink-faint">{domain}</span>
      </span>
      <i className="ph-bold ph-arrow-square-out text-ink-faint transition-colors group-hover:text-black" aria-hidden="true" />
    </a>
  )
}

export default function ReferenceEmbeds({ references }: { references: Reference[] }) {
  if (!references.length) return null

  const videos = references.filter((r) => youtubeId(r.url))
  const rest = references.filter((r) => !youtubeId(r.url))

  return (
    <div className="space-y-4">
      {videos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {videos.map((r, i) => (
            <YouTubeEmbed key={`v-${i}`} id={youtubeId(r.url)!} title={r.title} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rest.map((r, i) => {
            const repo = repoInfo(r.url)
            return repo ? (
              <RepoCard key={`r-${i}`} reference={r} repo={repo} />
            ) : (
              <LinkCard key={`r-${i}`} reference={r} />
            )
          })}
        </div>
      )}
    </div>
  )
}
