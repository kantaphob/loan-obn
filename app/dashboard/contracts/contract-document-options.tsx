'use client'

import { useId } from 'react'

export const signingMethods = [
  { value: 'PRINT', label: 'พิมพ์เซ็น', description: 'พิมพ์เอกสารเพื่อลงลายมือชื่อ' },
  { value: 'E_SIGNATURE', label: 'e-signature', description: 'ลงลายมือชื่ออิเล็กทรอนิกส์' },
] as const
export const documentPackages = [
  { value: 'LOAN', label: 'สัญญาเงินกู้' },
  { value: 'LOAN_GUARANTEE', label: 'สัญญาเงินกู้ & สัญญาค้ำเงินกู้' },
  { value: 'LOAN_GUARANTEE_COLLATERAL', label: 'สัญญาเงินกู้ & สัญญาค้ำเงินกู้ & สัญญากู้ยืมเงินทั่วไป (แบบมีหลักประกัน)' },
] as const
const collateralReference = 'https://lawdivision.kku.ac.th/wp-content/uploads/2020/11/สัญญากู้ยืมเงินทั่วไป-แบบมีหลักประกัน.doc'

export function ContractDocumentOptions({ signingMethod, documentPackage, onSigningChange, onPackageChange }: { signingMethod: string; documentPackage: string; onSigningChange: (value: string) => void; onPackageChange: (value: string) => void }) {
  const id = useId()
  const cardClass = (selected: boolean) => `flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm ${selected ? 'border-emerald-600 bg-emerald-50/70' : 'border-slate-300 bg-white/40'} focus-within:ring-2 focus-within:ring-slate-400`

  return <div className="mt-4 space-y-5 rounded-2xl border border-slate-200 bg-white/30 p-4 sm:p-5">
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-3 text-sm font-medium">วิธีลงนามเอกสาร</legend>
      <div className="grid gap-3 sm:grid-cols-2">{signingMethods.map(method => <label key={method.value} className={cardClass(signingMethod === method.value)}>
        <input type="radio" name={`${id}-signing`} value={method.value} checked={signingMethod === method.value} onChange={() => onSigningChange(method.value)} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" />
        <span><span className="block font-medium">{method.label}</span><span className="mt-1 block text-xs text-slate-500">{method.description}</span></span>
      </label>)}</div>
    </fieldset>
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-3 text-sm font-medium">ชุดเอกสารสัญญา</legend>
      <div className="space-y-3">{documentPackages.map(pack => <label key={pack.value} className={cardClass(documentPackage === pack.value)}>
        <input type="radio" name={`${id}-package`} value={pack.value} checked={documentPackage === pack.value} onChange={() => onPackageChange(pack.value)} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" />
        <span className="font-medium leading-6">{pack.label}</span>
      </label>)}</div>
    </fieldset>
    {documentPackage === 'LOAN_GUARANTEE_COLLATERAL' && <a href={collateralReference} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-sky-700 underline underline-offset-4">ดูเอกสารอ้างอิง: สัญญากู้ยืมเงินทั่วไป (แบบมีหลักประกัน)</a>}
  </div>
}
