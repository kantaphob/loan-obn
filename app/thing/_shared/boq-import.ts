import type { BoqItem } from './model'

/** Read tab-separated BOQ data, including quoted cells that contain newlines. */
export function parseBoqTsv(text: string): BoqItem[] {
  const rows: string[][] = []
  let row: string[] = []; let cell = ''; let quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++ }
      else if (quoted) quoted = false
      else if (!cell.trim()) quoted = true
      else cell += char
    }
    else if (char === '\t' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  if (quoted) throw new Error('ไฟล์ข้อความมีเครื่องหมายคำพูดไม่ครบ')
  if (!rows.some(candidate => candidate.some(value => /รายการ/.test(value)) && candidate.some(value => /หน่วย/.test(value)))) throw new Error('ไม่พบหัวตาราง BOQ ในไฟล์ข้อความ')

  let category = 'หมวดงานทั่วไป'; let subcategory = ''
  const items: BoqItem[] = []
  const numberAt = (values: string[], index: number) => {
    const raw = (values[index] ?? '').replaceAll(',', '').trim()
    const parsed = Number(raw)
    return raw && Number.isFinite(parsed) ? parsed : 0
  }
  for (const values of rows) {
    const sequence = (values[0] ?? '').trim()
    const name = (values[1] ?? '').trim()
    if (!name || /^(รายการ|ลำดับที่)$/.test(name)) continue
    const quantity = numberAt(values, 2); const unit = (values[3] ?? '').trim()
    const materialRate = numberAt(values, 4); const materialTotal = numberAt(values, 5)
    const laborRate = numberAt(values, 6); const laborTotal = numberAt(values, 7)
    const boqTotal = numberAt(values, 8); const note = (values[9] ?? '').trim()
    const hasCost = quantity > 0 || materialRate > 0 || materialTotal > 0 || laborRate > 0 || laborTotal > 0 || boqTotal > 0
    if (!hasCost) {
      if (/หมวด/.test(name) || (sequence && /^\d+(?:\.\d+)*$/.test(sequence))) { category = name.replace(/^\d+(?:\.\d+)*\s*/, '').replace(/^หมวด\s*/, '').trim() || name; subcategory = '' }
      else subcategory = name
      continue
    }
    const safeQuantity = quantity > 0 ? quantity : 1
    const itemSubcategory = /^[-–•]\s*/.test(name) ? subcategory : ''
    // Prefer the document's material line total over rate × quantity. Some source BOQs
    // contain rounded or manually adjusted totals that do not exactly equal that product.
    const materialPrice = materialTotal > 0 ? materialTotal / safeQuantity : materialRate
    items.push({ id: crypto.randomUUID(), scope: 'construction', category, subcategory: itemSubcategory, name, spec: '', quantity: safeQuantity, unit: unit || 'งาน', price: materialPrice, labor: values[7]?.trim() ? laborTotal : laborRate * safeQuantity, paid: 0, vendor: '', reference: '', materialTotal, laborRate, boqTotal, note })
    if (subcategory && !itemSubcategory) subcategory = ''
  }
  return items
}
