import { describe, expect, it } from 'vitest'
import { createVisitTalkOrder } from './talk-order.js'

describe('createVisitTalkOrder', () => {
  it('pins existing votes and shuffles the remaining talks for the visit', () => {
    const randomValues = [0, 0.75, 0.25]
    let randomIndex = 0

    const order = createVisitTalkOrder(
      ['talk-a', 'talk-b', 'talk-c', 'talk-d', 'talk-e'],
      new Set(['talk-c']),
      () => randomValues[randomIndex++],
    )

    expect(order).toEqual(['talk-c', 'talk-b', 'talk-e', 'talk-d', 'talk-a'])
  })
})
