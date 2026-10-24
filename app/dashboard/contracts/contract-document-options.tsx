'use client'

import { useId } from 'react'

export const signingMethods = [
  { value: 'PRINT', label: 'พิมพ์เซ็น', description: 'พิมพ์เอกสารเพื่อลงลายมือชื่อ' },
  { value: 'E_SIGNATURE', label: 'e-signature', description: 'ผู้กู้และผู้ให้กู้ลงลายมือชื่อบนจอในหน้าสัญญา' },
] as const
export const documentPackages = [
  { value: 'LOAN', label: 'สัญญาเงินกู้' },
  { value: 'LOAN_GUARANTEE', label: 'สัญญาเงินกู้ & สัญญาค้ำเงินกู้' },
  { value: 'LOAN_GUARANTEE_COLLATERAL', label: 'สัญญาเงินกู้ & สัญญาค้ำเงินกู้ & ข้อตกลงหลักประกัน (จำนอง/จำนำ)' },
] as const

export function WitnessCountOptions({ witnessCount, onWitnessChange, documentLabel }: { witnessCount: number; onWitnessChange: (count: number) => void; documentLabel: string }) {
  const id = useId()
  const cardClass = (selected: boolean) => `flex cursor-pointer items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm transition-colors ${selected ? 'border-emerald-600 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50'} focus-within:ring-2 focus-within:ring-sky-400`
  return <fieldset className="m-0 min-w-0 border-0 p-0">
    <legend className="mb-3 text-sm font-semibold text-slate-800">พยานใน{documentLabel} <span className="font-normal text-slate-500">(เลือกหนึ่งแบบ)</span></legend>
    <div className="grid gap-2.5 sm:grid-cols-3">{[0, 1, 2].map(count => <label key={count} className={cardClass(witnessCount === count)}>
      <input type="radio" name={`${id}-witnesses`} checked={witnessCount === count} onChange={() => onWitnessChange(count)} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" />
      <span>{count === 0 ? 'ไม่มีพยาน' : `พยาน ${count} คน`}</span>
    </label>)}</div>
  </fieldset>
}

export function ContractDocumentOptions({ signingMethod, documentPackage, onSigningChange, onPackageChange, witnessCount, onWitnessChange }: { witnessCount: number; onWitnessChange: (count: number) => void; signingMethod: string; documentPackage: string; onSigningChange: (value: string) => void; onPackageChange: (value: string) => void }) {
  const id = useId()
  const cardClass = (selected: boolean) => `flex cursor-pointer items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm transition-colors ${selected ? 'border-emerald-600 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50'} focus-within:ring-2 focus-within:ring-sky-400`

  return <div className="mt-3 space-y-5 rounded-xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/50 to-white p-3.5 sm:p-4">
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-800">ก</span>วิธีลงนามเอกสาร</legend>
      <div className="grid gap-2.5 sm:grid-cols-2">{signingMethods.map(method => <label key={method.value} className={cardClass(signingMethod === method.value)}>
        <input type="radio" name={`${id}-signing`} value={method.value} checked={signingMethod === method.value} onChange={() => onSigningChange(method.value)} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" />
        <span><span className="block font-semibold text-slate-800">{method.label}</span><span className="mt-1 block text-xs font-normal leading-4 text-slate-500">{method.description}</span></span>
      </label>)}</div>
    </fieldset>
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="grid h-6 w-6 place-items-center rounded-lg bg-violet-100 text-xs font-bold text-violet-800">ข</span>ชุดเอกสารสัญญา</legend>
      <div className="space-y-2.5">{documentPackages.map(pack => <label key={pack.value} className={cardClass(documentPackage === pack.value)}>
        <input type="radio" name={`${id}-package`} value={pack.value} checked={documentPackage === pack.value} onChange={() => onPackageChange(pack.value)} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" />
        <span className="font-semibold leading-5 text-slate-800">{pack.label}</span>
      </label>)}</div>
    </fieldset>
    <WitnessCountOptions witnessCount={witnessCount} onWitnessChange={onWitnessChange} documentLabel="สัญญาเงินกู้ 3.1" />
  </div>
}
