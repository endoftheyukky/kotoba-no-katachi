// resolve extensionless relative imports to .ts (for importing the repo's TS modules in node)
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context) } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' && /^\.\.?\//.test(specifier)) return next(specifier + '.ts', context)
    throw e
  }
}
