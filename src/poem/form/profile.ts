/**
 * v3 — composition space (experiment, review only).
 *
 * A page's form described by continuous quantities instead of by the name of
 * the grammar that made it. The same fields serve twice:
 *
 *   measured  what a drawn page actually is (form/measure.ts), read from its
 *             marks alone — so pages made by different grammars can be
 *             placed in one space and compared
 *   target    what the title asks of the form (form/target.ts), read from
 *             the analysis — each field with the linguistic property that
 *             moves it
 *
 * All fields are 0–1. None of them is a style: each is a geometric property
 * of the arrangement of marks on the page.
 */

export const AXES = [
  'curvature',
  'closure',
  'radiality',
  'fragmentation',
  'dispersion',
  'periodicity',
  'branching',
  'hierarchy',
  'rotation',
  'axis',
  'symmetry',
  'containment',
  'porosity',
  'linearity',
] as const

export type Axis = (typeof AXES)[number]

/**
 *   curvature    how far the figure bends: the arc its marks subtend around the circle that fits them
 *   closure      how far that arc closes on itself (a ring 1, an arc part of it, a line 0)
 *   radiality    how far the page is organised around one centre: a nucleus, with marks all round it
 *   fragmentation how far the figure falls into pieces: cut glyphs, and separate groups on the page
 *   dispersion   how far the marks spread over the page from their centre of mass
 *   periodicity  how evenly the marks are spaced (a lattice 1, a scatter 0)
 *   branching    how far the figure forks: long branches of its spanning tree beyond a line's two ends
 *   hierarchy    how far the sizes differ (one size 0, macro and micro together 1)
 *   rotation     how coherently the marks are turned (all alike 1, turned through a full cycle 0)
 *   axis         how far the page is two masses held apart
 *   symmetry     how much of the mass has a mirror partner (vertical, horizontal or central)
 *   containment  how much of the mass lies inside a larger mark
 *   porosity     how much of the figure's own hull is white
 *   linearity    how far the figure is one continuous line (elongated, and without a long gap)
 */
export type FormProfile = Record<Axis, number>

/** a profile with every field at `v` */
export const flat = (v = 0): FormProfile => Object.fromEntries(AXES.map((k) => [k, v])) as FormProfile

export const distance = (p: FormProfile, q: FormProfile, w?: Partial<FormProfile>) =>
  Math.sqrt(AXES.reduce((s, k) => s + (w?.[k] ?? 1) * (p[k] - q[k]) ** 2, 0))
