/**
 * Where the admin sheet may be opened: only at the site's own address
 * (site.config.json, url), and on this computer while developing.
 *
 * Cloudflare Pages also serves every deployment at an address of its own
 * (<hash>.<project>.pages.dev, <branch>.<project>.pages.dev). Those copies keep
 * the secrets they were deployed with and read the same archive, so a password
 * or session changed since would still open them. From this version on they
 * do not open the admin sheet at all; deployments made before it still do,
 * until they are deleted (docs/site.md).
 */
import site from '../site.config.json'

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]'])

/** the site's own host, or '' when no address is configured (then no host is refused) */
export const SITE_HOST = site.url ? new URL(site.url).host : ''

export const adminHostAllowed = (url: URL) => !SITE_HOST || url.host === SITE_HOST || LOCAL.has(url.hostname)
