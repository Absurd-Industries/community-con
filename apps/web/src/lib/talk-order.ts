export function createVisitTalkOrder(
  talkIds: string[],
  votedIds: ReadonlySet<string>,
  random: () => number,
) {
  const voted = talkIds.filter((id) => votedIds.has(id))
  const unvoted = talkIds.filter((id) => !votedIds.has(id))

  for (let i = unvoted.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[unvoted[i], unvoted[j]] = [unvoted[j], unvoted[i]]
  }

  return [...voted, ...unvoted]
}
