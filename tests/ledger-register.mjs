import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return nextResolve(new URL('./ledger-next-server-stub.mjs', import.meta.url).href, context)
  if (specifier === 'next/cache') return nextResolve(new URL('./ledger-cache-stub.mjs', import.meta.url).href, context)
  return nextResolve(specifier === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : specifier, context)
} })
