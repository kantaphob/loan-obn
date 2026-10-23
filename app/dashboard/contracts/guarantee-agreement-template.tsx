import { contractDocumentSignaturesComplete, type ContractDocumentSignatureRecord } from '@/lib/contracts'

export function GuaranteeAgreementTemplate({ contractId, signingMethod, borrowerSignedAt, lenderSignedAt, guarantorSignedAt, witnessCount, witnesses = [], documentSignatures = [] }: {
  contractId: number; signingMethod?: string | null; borrowerSignedAt?: string | null; lenderSignedAt?: string | null
  guarantorSignedAt?: string | null; witnessCount: number; witnesses?: { position: number; signedAt: unknown }[]
  documentSignatures?: ContractDocumentSignatureRecord[]
}) {
  const complete = contractDocumentSignaturesComplete({ borrowerSignedAt, lenderSignedAt, guarantorSignedAt, documentPackage: 'LOAN_GUARANTEE', witnessCount, witnesses, documentSignatures }, 'GUARANTEE')
  const url = `/api/contracts/${contractId}/document?document=guarantee`
  const allowed = signingMethod !== 'E_SIGNATURE' || complete
  return <section className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white/50 p-4">
    <div><h3 className="m-0 text-sm font-semibold">สัญญาค้ำประกันการกู้ยืมเงิน</h3>
      <p className="mb-0 mt-1 text-xs text-slate-500">กรอกผู้ค้ำจากแบบฟอร์ม แล้วระบบนำชื่อคู่สัญญา ยอดกู้ และวันที่จากสัญญาเงินกู้มาเติมในเอกสารนี้{signingMethod === 'E_SIGNATURE' && !complete ? ' · รอลงนามครบ' : ''}</p></div>
    {allowed && <div className="flex flex-wrap gap-2"><a href={url} target="_blank" rel="noopener noreferrer" className="action-button action-button--secondary">เปิด PDF / พิมพ์สัญญาค้ำ</a><a href={`${url}&download=1`} download={`CT-${String(contractId).padStart(6, '0')}-guarantee.pdf`} className="action-button action-button--secondary">ดาวน์โหลดสัญญาค้ำ</a></div>}
    {allowed && <details><summary className="cursor-pointer text-xs font-medium text-sky-700">แสดงตัวอย่างสัญญาค้ำประกัน</summary><iframe src={`${url}#view=FitH`} title="ตัวอย่างสัญญาค้ำประกันที่กรอกข้อมูลแล้ว" loading="lazy" className="mt-3 h-[65dvh] min-h-80 w-full rounded-xl border border-slate-200 bg-white" /></details>}
  </section>
}
