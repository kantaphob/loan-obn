import { contractDocumentSignaturesComplete } from '@/lib/contracts'

export function LoanAgreementTemplate({ contractId, signingMethod, borrowerSignedAt, lenderSignedAt, guarantorSignedAt, documentPackage, witnessCount = 0, witnesses = [] }: { witnessCount?: number; witnesses?: { position: number; signedAt: unknown }[]; contractId?: number; signingMethod?: string | null; documentPackage?: string | null; borrowerSignedAt?: string | null; lenderSignedAt?: string | null; guarantorSignedAt?: string | null }) {
  const templateUrl = contractId ? `/api/contracts/${contractId}/document` : '/templates/contracts/loan-agreement.pdf'
  const needsElectronicSignatures = signingMethod === 'E_SIGNATURE'
  const signaturesComplete = contractDocumentSignaturesComplete({ borrowerSignedAt, lenderSignedAt, guarantorSignedAt, documentPackage, witnessCount, witnesses }, 'LOAN')
  const canOpenDocument = !needsElectronicSignatures || signaturesComplete
  return <section className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white/50 p-4">
    <div>
      <h3 className="m-0 text-sm font-semibold">{needsElectronicSignatures && signaturesComplete ? 'สัญญาที่ลงนามแล้ว' : contractId ? 'เอกสารสัญญาเงินกู้ที่กรอกข้อมูลแล้ว' : 'แม่แบบเอกสารสัญญาเงินกู้'}</h3>
      <p className="mb-0 mt-1 text-xs leading-5 text-slate-500">{needsElectronicSignatures
        ? signaturesComplete ? 'แทรกลายมือชื่อของผู้กู้ ผู้ให้กู้ และพยานที่กำหนดลงในเอกสารแล้ว' : 'รอผู้กู้ ผู้ให้กู้ และพยานที่กำหนดลงนามครบก่อนเปิดหรือดาวน์โหลดเอกสารฉบับลงนาม'
        : contractId ? 'ดึงข้อมูลจากสัญญาที่บันทึก · ช่องที่ไม่มีข้อมูลจะเว้นไว้ · เอกสารนี้ยังไม่มีลายมือชื่อ' : 'แบบฟอร์มต้นฉบับที่แนบมา · ยังไม่ได้กรอกข้อมูลผู้กู้ ผู้ให้กู้ หรือยอดเงิน'}</p>
    </div>
    {canOpenDocument && <div className="flex flex-wrap gap-2">
      <a href={templateUrl} target="_blank" rel="noopener noreferrer" className="action-button action-button--secondary">{needsElectronicSignatures ? 'เปิด PDF / พิมพ์ฉบับลงนาม' : contractId ? 'เปิด PDF / พิมพ์สัญญา' : 'เปิด PDF / พิมพ์แบบฟอร์ม'}</a>
      <a href={contractId ? `${templateUrl}?download=1` : templateUrl} download="หนังสือสัญญาเงินกู้.pdf" className="action-button action-button--secondary">{needsElectronicSignatures ? 'ดาวน์โหลดฉบับลงนาม' : contractId ? 'ดาวน์โหลดสัญญา' : 'ดาวน์โหลดแม่แบบ'}</a>
    </div>}
    {canOpenDocument && <details>
      <summary className="cursor-pointer text-xs font-medium text-sky-700">แสดงตัวอย่างเอกสาร</summary>
      <iframe src={`${templateUrl}#view=FitH`} title="ตัวอย่างแม่แบบหนังสือสัญญาเงินกู้" loading="lazy" className="mt-3 h-[65dvh] min-h-80 w-full rounded-xl border border-slate-200 bg-white" />
    </details>}
  </section>
}
