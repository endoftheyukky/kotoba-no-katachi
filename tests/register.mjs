// node --import ./tests/register.mjs: resolve the sources as Vite and Wrangler do (tests/hooks.mjs)
import { register } from 'node:module'

register('./hooks.mjs', import.meta.url)
