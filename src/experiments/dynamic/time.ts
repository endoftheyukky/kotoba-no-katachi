/**
 * Time as a pure function: every composition is a set of tracks that can be
 * read at any t. Stopping time anywhere must yield a composed page.
 */

export type Ease = (x: number) => number

export const linear: Ease = (x) => x
export const inOut: Ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x)
/** fast departure, settling arrival: a rupture */
export const out: Ease = (x) => 1 - (1 - x) ** 3

interface Key {
  t: number
  v: number
  ease: Ease
}

export class Track {
  private keys: Key[]

  constructor(initial: number) {
    this.keys = [{ t: 0, v: initial, ease: linear }]
  }

  private get last(): Key {
    return this.keys[this.keys.length - 1]
  }

  /** Keep the current value until t. */
  hold(t: number): this {
    this.keys.push({ t: Math.max(t, this.last.t), v: this.last.v, ease: linear })
    return this
  }

  /** Move from the previous key to v, arriving at t. */
  to(t: number, v: number, ease: Ease = linear): this {
    this.keys.push({ t: Math.max(t, this.last.t), v, ease })
    return this
  }

  /** Jump to v at t. */
  set(t: number, v: number): this {
    return this.hold(t).to(t, v)
  }

  at(t: number): number {
    const keys = this.keys
    if (t <= keys[0].t) return keys[0].v
    let i = keys.length - 1
    while (i > 0 && keys[i].t > t) i--
    if (i === keys.length - 1) return keys[i].v
    const a = keys[i]
    const b = keys[i + 1]
    const x = (t - a.t) / (b.t - a.t)
    return a.v + (b.v - a.v) * b.ease(x)
  }
}
