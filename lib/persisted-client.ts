const writes = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany'])
/** Keep Prisma promises lazy, including array transactions; run effects after commit. */
export function withPersistence<T extends object>(client: T, afterCommit: () => Promise<void>): T {
  const delegates = new Map<PropertyKey, object>()
  const originals = new WeakMap<object, object>()
  const mutations = new WeakSet<object>()
  const effect = async () => {
    try { await afterCommit() } catch (error) { console.error('Post-commit persistence failed:', error instanceof Error ? error.message : 'unknown') }
  }
  function observe(promise: object, changed: () => boolean = () => true) {
    let observed: Promise<unknown> | undefined
    const result = new Proxy(promise, {
      get(target, method) {
        if (['then', 'catch', 'finally'].includes(String(method))) {
          return (...args: unknown[]) => {
            observed ??= Promise.resolve(target).then(async value => { if (changed()) await effect(); return value })
            return Reflect.apply(Reflect.get(observed, method), observed, args)
          }
        }
        const value = Reflect.get(target, method)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    originals.set(result, promise)
    if (changed()) mutations.add(result)
    return result
  }
  return new Proxy(client, {
    get(target, property) {
      const value = Reflect.get(target, property)
      if (typeof value === 'function') {
        if (property === '$transaction') return (...args: unknown[]) => {
          let changed = false
          if (Array.isArray(args[0])) {
            changed = args[0].some(item => mutations.has(item))
            args[0] = args[0].map(item => originals.get(item) ?? item)
          } else if (typeof args[0] === 'function') {
            const callback = args[0] as (tx: object) => Promise<unknown>
            args[0] = (tx: object) => callback(withPersistence(tx, async () => { changed = true }))
          }
          return observe(Reflect.apply(value, target, args), () => changed)
        }
        if (['$executeRaw', '$executeRawUnsafe'].includes(String(property))) return (...args: unknown[]) => observe(Reflect.apply(value, target, args))
        return value.bind(target)
      }
      if (value && typeof value === 'object' && !String(property).startsWith('_')) {
        if (!delegates.has(property)) delegates.set(property, new Proxy(value, {
          get(delegate, method) {
            const operation = Reflect.get(delegate, method)
            if (typeof operation !== 'function') return operation
            return writes.has(String(method)) ? (...args: unknown[]) => observe(Reflect.apply(operation, delegate, args)) : operation.bind(delegate)
          },
        }))
        return delegates.get(property)
      }
      return value
    },
  })
}
