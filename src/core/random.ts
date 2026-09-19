/**
 * Seeded randomness. The same word must always produce the same poem,
 * so every decision that is not fixed by a linguistic rule draws from here.
 */

/** cyrb53, folded to 32 bits. */
export function hash(text: string): number {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h1 ^ h2) >>> 0
}

/** mulberry32 */
export class Rng {
  private state: number

  constructor(readonly seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next()
  }

  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)]
  }

  /** Index chosen with probability proportional to its weight. */
  weighted(weights: readonly number[]): number {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]
      if (r < 0) return i
    }
    return weights.length - 1
  }

  /** An independent stream, so one rule's choices never shift another's. */
  fork(label: string): Rng {
    return new Rng(hash(`${this.seed}:${label}`))
  }
}
