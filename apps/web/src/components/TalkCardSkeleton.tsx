/** Placeholder shaped like a talk card, shown while talks load. */
export default function TalkCardSkeleton({ withActions = false }: { withActions?: boolean }) {
  return (
    <div className="ui-card flex flex-col p-5" aria-hidden="true">
      <div className="skeleton mb-3 h-5 w-24 rounded-full" />
      <div className="skeleton h-5 w-full" />
      <div className="skeleton mt-2 h-5 w-4/5" />
      <div className="skeleton mt-4 h-4 w-1/2" />
      {withActions && (
        <div className="mt-5 flex gap-2">
          <div className="skeleton h-10 flex-1" />
          <div className="skeleton h-10 flex-1" />
        </div>
      )}
    </div>
  )
}

/** A grid of talk-card placeholders. */
export function TalkGridSkeleton({ count = 6, withActions = false }: { count?: number; withActions?: boolean }) {
  return (
    <div className="card-grid grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading talks">
      {Array.from({ length: count }, (_, i) => (
        <TalkCardSkeleton key={i} withActions={withActions} />
      ))}
      <span className="sr-only">Loading talks…</span>
    </div>
  )
}
