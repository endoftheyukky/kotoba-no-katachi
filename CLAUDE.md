# CLAUDE.md

Read CONCEPT.md before making any artistic or technical decision.

This is an artwork, not a product UI.

## Current goal

Build a small experimental prototype for dynamic concrete poetry.

Do NOT implement the full NLP / embedding system yet.

The first prototype exists to test whether typography, time and sound
can form a convincing poem.

## Stack

Use:

- Vite
- TypeScript
- SVG as the primary visual rendering system
- Web Audio API or Tone.js for sound

Keep dependencies minimal.

Design the code so OpenType glyph paths and semantic embeddings
can be added later.

## Prototype interaction

The initial page should contain only:

1. a minimal text input
2. a start action
3. the artwork canvas

After starting, interface elements should disappear or become unobtrusive.

## First prototype

Allow the user to enter one Japanese word.

Generate a deterministic 15–30 second audiovisual composition from that word.

Use a seeded random system so the same word can reproduce the same composition.

The first version may use only simple linguistic properties and does not need
advanced Japanese NLP.

Implement several independent poetic operations such as:

- repetition
- spatial separation
- changing scale
- changing spacing
- rotation
- cropping
- masking
- partial visibility
- gradual disappearance
- rhythmic appearance
- silence
- character-by-character decomposition

Do not use all operations simultaneously.

The system should choose a small number of operations for each composition.

## Typography architecture

Do not treat typography only as DOM text.

Create an abstraction that allows a glyph to later become:

- normal text
- SVG outline
- clipped glyph
- masked glyph
- fragmented glyph
- collection of glyph parts

The first implementation may use SVG text and clipPath/mask,
but structure the code so opentype.js can later provide glyph outlines.

## Audio architecture

Do not create background music.

Sound should emerge from the word.

For the first prototype, derive a sparse sound structure from properties such as:

- character count
- repetition
- timing
- Japanese mora-like segmentation where possible

Silence should dominate much of the composition.

Keep the audio restrained and experimental.

## Artistic guardrails

Never add the following without explicit approval:

- gradients
- particle systems
- 3D graphics
- conventional music
- cinematic sound effects
- decorative animation
- glowing effects
- generic glitch aesthetics
- illustrations
- colorful UI
- cards or dashboard-style interfaces

Whenever adding an effect, ask internally:

"What linguistic property causes this?"

If there is no answer, do not add it.

## Development rule

Before coding a new visual behavior, describe:

1. linguistic input
2. transformation rule
3. visual output
4. sound output, if any

Keep these rules explicit in the code.

Prefer a small number of strong rules to many decorative effects.
