import type { ContractBoqSummary } from './model'
/** Summary PDFs sometimes put the amount one text baseline above/below its label. */
export function readContractBoqSummary(lines: string[], summary: ContractBoqSummary, reference: string) {
  const normalize = (text: string) => text.replace(/\s/g, '').normalize('NFKC')
  const number = (text: string) => { const matched = text.match(/[\d,]+\.\d{2}/)?.[0]; return matched ? Number(matched.replaceAll(',','')) : undefined }
  function amountAt(index: number, allowPrevious = false) {
    if (index < 0) return undefined
    const inline = number(lines[index])
    if (inline !== undefined) return inline
    const next = lines[index+1] ?? '', previous = lines[index-1] ?? ''
    if (/^[\d,. ]+$/.test(next)) return number(next)
    if (allowPrevious && /^[\d,. ]+$/.test(previous)) return number(previous)
    return undefined
  }
  const rows = summary.rows.map((row,i) => { const index = lines.findIndex(line => new RegExp(`^${i+1}\\s+หมวด`).test(line)); const amount = amountAt(index); return amount === undefined ? row : {...row,amount} })
  const feeIndex = lines.findIndex(line => /ค่าด(?:ำ|า|ํา)เนินงานก่อสร้าง/.test(normalize(line)))
  const agreedIndex = lines.findIndex(line => normalize(line).includes('คิดเป็นค่าก่อสร้างเพียง'))
  const found = lines.some(line => /^\d+\s+หมวด/.test(line))
  return found ? {...summary,rows,managementFee:amountAt(feeIndex) ?? summary.managementFee,agreedTotal:amountAt(agreedIndex,true) ?? summary.agreedTotal,reference} : null
}
