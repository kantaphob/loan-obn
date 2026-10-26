import { createHash } from 'node:crypto'
const sortedJson = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortedJson(value[key])])) : Array.isArray(value) ? value.map(sortedJson) : value
function timestamp(value) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint' || typeof value === 'number') return new Date(Number(value)).toISOString()
  return new Date(/^\d+$/.test(value) ? Number(value) : value.includes('T') ? value : value.replace(' ', 'T') + 'Z').toISOString()
}
export function normalized(value, column) {
  if (value === null) return null
  if (column.data_type.startsWith('timestamp')) return timestamp(value)
  if (column.data_type === 'boolean') return Boolean(Number(value))
  if (column.data_type === 'jsonb' || column.data_type === 'json') return JSON.stringify(sortedJson(typeof value === 'string' ? JSON.parse(value) : value))
  if (column.data_type === 'bytea') return Buffer.from(value).toString('hex')
  if (['integer','bigint','smallint','numeric','decimal'].includes(column.data_type)) return String(value).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '')
  if (['double precision','real'].includes(column.data_type)) return Number(value)
  return String(value)
}
export const digest = rows => createHash('sha256').update(rows.map(JSON.stringify).sort().join('\n')).digest('hex')
