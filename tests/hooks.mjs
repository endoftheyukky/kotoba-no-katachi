// Module hooks for the unit tests (tests/register.mjs): the sources import
// each other without extensions, as Vite and Wrangler resolve them, and one
// server module imports site.config.json. Node is taught the same.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && !/\.[cm]?[jt]s$|\.json$/.test(specifier) && context.parentURL) {
    for (const ending of ['.ts', '/index.ts']) {
      const url = new URL(specifier + ending, context.parentURL)
      if (existsSync(fileURLToPath(url))) return next(url.href, context)
    }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (url.endsWith('.json')) {
    return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')}`, shortCircuit: true }
  }
  return next(url, context)
}
