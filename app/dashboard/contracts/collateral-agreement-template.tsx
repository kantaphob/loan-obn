import { CollateralAttachments } from './collateral-attachments'

export function CollateralAgreementTemplate({ contractId, signingMethod, signaturesComplete }: { contractId: number; signingMethod?: string | null; signaturesComplete: boolean }) {
  const url = `/api/contracts/${contractId}/document?document=collateral`
  const allowed = signingMethod !== 'E_SIGNATURE' || signaturesComplete
  return <section className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white/50 p-3 sm:p-4">
    <div><h3 className="m-0 text-sm font-semibold">สัญญาค้ำประกันและข้อตกลงจัดให้มีทรัพย์สินเป็นหลักประกัน</h3>
      <p className="mb-0 mt-1 text-xs text-slate-500">นำรายละเอียดบัญชีทรัพย์และข้อมูลคู่สัญญาจากสัญญานี้ไปเติมในเอกสาร{signingMethod === 'E_SIGNATURE' && !signaturesComplete ? ' · รอลงนามเอกสารก่อนหน้าให้ครบ' : ''}</p></div>
    {allowed && <div className="flex flex-wrap gap-2"><a href={url} target="_blank" rel="noopener noreferrer" className="action-button action-button--secondary">เปิด PDF / พิมพ์สัญญาหลักประกัน</a><a href={`${url}&download=1`} download={`CT-${String(contractId).padStart(6, '0')}-collateral.pdf`} className="action-button action-button--secondary">ดาวน์โหลดสัญญาหลักประกัน</a></div>}
    {allowed && <details><summary className="cursor-pointer text-xs font-medium text-sky-700">แสดงตัวอย่างสัญญาหลักประกัน</summary><iframe src={`${url}#view=FitH`} title="ตัวอย่างสัญญาหลักประกันที่กรอกข้อมูลแล้ว" loading="lazy" className="mt-3 h-[65dvh] min-h-80 w-full rounded-xl border border-slate-200 bg-white" /></details>}
    <CollateralAttachments contractId={contractId} />
  </section>
}
