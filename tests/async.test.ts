import { describe, expect, it } from 'vitest'

import { mapWithConcurrency } from '@/lib/async'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('mapWithConcurrency', () => {
  it('renvoie un tableau vide sans appeler la fonction', async () => {
    let calls = 0
    const out = await mapWithConcurrency([], 4, async () => {
      calls += 1
      return 1
    })
    expect(out).toEqual([])
    expect(calls).toBe(0)
  })

  it('conserve l’ordre des entrées malgré le parallélisme', async () => {
    const items = [30, 10, 20, 5]
    const out = await mapWithConcurrency(items, 2, async (ms, index) => {
      await wait(ms)
      return `item-${index}`
    })
    expect(out).toEqual(['item-0', 'item-1', 'item-2', 'item-3'])
  })

  it('ne dépasse jamais la limite de tâches simultanées', async () => {
    let inFlight = 0
    let peak = 0
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await wait(5)
      inFlight -= 1
    })
    expect(peak).toBeLessThanOrEqual(3)
  })

  it('traite tous les éléments même si la limite dépasse la taille', async () => {
    const seen: number[] = []
    await mapWithConcurrency([1, 2, 3], 99, async (n) => {
      seen.push(n)
    })
    expect(seen.sort()).toEqual([1, 2, 3])
  })

  it('propage l’erreur d’un élément', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boum')
        return n
      }),
    ).rejects.toThrow('boum')
  })
})
