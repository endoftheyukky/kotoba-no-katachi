export const clamp = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x))

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
