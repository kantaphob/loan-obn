'use client'

import { useId } from 'react'

export type CollateralAgreementValues = Record<string, string>

type Field = { key: string; label: string; kind?: 'textarea' | 'date' | 'number' | 'select'; placeholder?: string; options?: { value: string; label: string }[] }
const sections: { title: string; description?: string; fields: Field[] }[] = [
  { title: 'ผู้ให้หลักประกันและขอบเขตหนี้', fields: [
    { key: 'providerRole', label: 'ฐานะผู้ให้หลักประกัน', kind: 'select', options: [{ value: 'ลูกหนี้', label: 'ลูกหนี้' }, { value: 'บุคคลภายนอก', label: 'บุคคลภายนอก' }] },
    { key: 'providerName', label: 'ชื่อผู้ให้หลักประกัน', placeholder: 'เว้นว่างเพื่อใช้ชื่อผู้กู้' }, { key: 'providerNationalId', label: 'เลขประจำตัวประชาชน / ทะเบียนนิติบุคคล' },
    { key: 'providerAddress', label: 'ที่อยู่ผู้ให้หลักประกัน', kind: 'textarea' }, { key: 'providerPhone', label: 'โทรศัพท์' },
    { key: 'guarantorNationalId', label: 'เลขประจำตัวผู้ค้ำประกัน (ถ้ามี)' }, { key: 'guarantorPhone', label: 'โทรศัพท์ผู้ค้ำประกัน (ถ้ามี)' },
    { key: 'securedDebtType', label: 'ประเภทหนี้ / ชื่อสัญญาหลัก', placeholder: 'เช่น สัญญากู้ยืมเงิน' },
    { key: 'debtPurpose', label: 'วัตถุประสงค์หนี้', kind: 'textarea' },
    { key: 'defaultInterestPercent', label: 'ดอกเบี้ยผิดนัดต่อปี (%)', kind: 'number' },
    { key: 'maximumSecuredAmount', label: 'วงเงินสูงสุดที่ค้ำ/ประกัน (บาท)', kind: 'number' },
    { key: 'futureDebtType', label: 'ประเภทหนี้ในอนาคต (ถ้ามี)' }, { key: 'futureDebtPurpose', label: 'วัตถุประสงค์หนี้ในอนาคต (ถ้ามี)' },
    { key: 'futureDebtStart', label: 'เริ่มก่อหนี้ตั้งแต่', kind: 'date' }, { key: 'futureDebtEnd', label: 'สิ้นสุดช่วงก่อหนี้', kind: 'date' },
    { key: 'copyCount', label: 'จำนวนฉบับที่จัดทำ', kind: 'number' },
  ] },
  { title: 'บัญชี ก · อสังหาริมทรัพย์ / ทรัพย์จดทะเบียนจำนอง', description: 'กรอกเมื่อเลือกใช้บัญชี ก', fields: [
    { key: 'propertyType', label: 'ประเภททรัพย์', placeholder: 'ที่ดิน / ที่ดินพร้อมสิ่งปลูกสร้าง / ห้องชุด / อื่น ๆ' },
    { key: 'propertyOwner', label: 'เจ้าของกรรมสิทธิ์' }, { key: 'ownershipShare', label: 'สัดส่วนกรรมสิทธิ์' },
    { key: 'titleDeedNumber', label: 'โฉนด / หนังสือแสดงสิทธิเลขที่' }, { key: 'landNumber', label: 'เลขที่ดิน' }, { key: 'surveyNumber', label: 'หน้าสำรวจ' },
    { key: 'propertySubdistrict', label: 'ตำบล / แขวง' }, { key: 'propertyDistrict', label: 'อำเภอ / เขต' }, { key: 'propertyProvince', label: 'จังหวัด' },
    { key: 'areaRai', label: 'เนื้อที่ (ไร่)', kind: 'number' }, { key: 'areaNgan', label: 'เนื้อที่ (งาน)', kind: 'number' }, { key: 'areaSquareWa', label: 'เนื้อที่ (ตารางวา)', kind: 'number' },
    { key: 'buildingNumber', label: 'เลขที่สิ่งปลูกสร้าง' }, { key: 'condoBuilding', label: 'อาคารชุด' }, { key: 'condoRoom', label: 'ห้องเลขที่' },
    { key: 'condoFloor', label: 'ชั้น' }, { key: 'condoArea', label: 'พื้นที่ห้องชุด (ตร.ม.)', kind: 'number' }, { key: 'condoTitleNumber', label: 'หนังสือกรรมสิทธิ์ห้องชุดเลขที่' },
    { key: 'propertyAppraisalValue', label: 'ราคาประเมิน (บาท)', kind: 'number' }, { key: 'propertyEncumbrances', label: 'ภาระผูกพัน / ผู้รับจำนองเดิม / เจ้าของร่วม', kind: 'textarea' },
    { key: 'consentingPerson', label: 'คู่สมรส / ผู้มีอำนาจให้ความยินยอม' }, { key: 'consentEvidence', label: 'หลักฐานความยินยอมที่แนบ' },
    { key: 'mortgageAmount', label: 'จำนวนเงินจำนอง (บาท)', kind: 'number' }, { key: 'registrationOffice', label: 'หน่วยงานจดทะเบียน' },
    { key: 'mortgageDeadline', label: 'กำหนดจดทะเบียน', kind: 'date' }, { key: 'actualMortgageDate', label: 'วันจดทะเบียนจริง', kind: 'date' }, { key: 'mortgagePriority', label: 'ลำดับจำนอง' },
  ] },
  { title: 'บัญชี ข · สังหาริมทรัพย์และหลักฐานรับมอบ', description: 'กรอกเมื่อเลือกใช้บัญชี ข และใช้กับทรัพย์ที่ส่งมอบจริง', fields: [
    { key: 'pledgeItemNumber', label: 'รายการที่' }, { key: 'pledgedAssetType', label: 'ประเภททรัพย์ที่จำนำ' },
    { key: 'movableOwner', label: 'เจ้าของกรรมสิทธิ์' }, { key: 'acquisitionEvidence', label: 'หลักฐานการได้มา' },
    { key: 'brandModel', label: 'ยี่ห้อ / รุ่น' }, { key: 'serialOrRegistration', label: 'หมายเลขเครื่อง / ตัวถัง / ทะเบียน' },
    { key: 'assetDescription', label: 'รายละเอียดทรัพย์ / น้ำหนัก / ขนาด / จำนวน', kind: 'textarea' }, { key: 'assetCondition', label: 'สภาพทรัพย์และอุปกรณ์ที่ส่งมอบ', kind: 'textarea' },
    { key: 'movableAppraisalValue', label: 'ราคาประเมินร่วมกัน (บาท)', kind: 'number' }, { key: 'movableAppraisalDate', label: 'วันที่ประเมิน', kind: 'date' }, { key: 'appraiser', label: 'ผู้ประเมิน' },
    { key: 'movableEncumbrances', label: 'ภาระผูกพัน / ข้อจำกัด / สิทธิบุคคลอื่น', kind: 'textarea' }, { key: 'attachmentReferences', label: 'เลขที่ภาพถ่ายและเอกสารประกอบ' },
    { key: 'handoverDate', label: 'วันที่ส่งมอบทรัพย์', kind: 'date' }, { key: 'handoverTime', label: 'เวลาส่งมอบ' }, { key: 'handoverPlace', label: 'สถานที่ส่งมอบ', kind: 'textarea' },
    { key: 'custodianName', label: 'ผู้รับมอบ / ผู้เก็บรักษา' }, { key: 'custodianNationalId', label: 'เลขประจำตัวผู้รับมอบ' },
    { key: 'custodianAddress', label: 'ที่อยู่ผู้รับมอบ', kind: 'textarea' }, { key: 'custodianPhone', label: 'โทรศัพท์ผู้รับมอบ' },
    { key: 'custodianRole', label: 'ฐานะผู้เก็บรักษา', kind: 'select', options: [{ value: 'เจ้าหนี้ผู้รับจำนำ', label: 'เจ้าหนี้ผู้รับจำนำ' }, { value: 'บุคคลภายนอกที่คู่สัญญาตกลงร่วมกัน', label: 'บุคคลภายนอกที่ตกลงร่วมกัน' }] },
    { key: 'storagePlace', label: 'สถานที่เก็บรักษา', kind: 'textarea' }, { key: 'handoverExceptions', label: 'รายการที่ขาด / ข้อยกเว้นขณะรับมอบ', kind: 'textarea' },
    { key: 'careAndInsurance', label: 'ค่าดูแล / ประกันภัยที่ตกลง (ถ้ามี)', kind: 'textarea' },
    { key: 'returnDate', label: 'วันที่คืนทรัพย์ (กรอกเมื่อหนี้ระงับ)', kind: 'date' }, { key: 'returnRecipient', label: 'ผู้รับคืน' }, { key: 'returnCondition', label: 'สภาพ / รายการทรัพย์ที่คืน', kind: 'textarea' },
  ] },
]

export function CollateralAgreementFields({ value, onChange }: { value: CollateralAgreementValues; onChange: (value: CollateralAgreementValues) => void }) {
  const id = useId()
  function update(key: string, nextValue: string) { onChange({ ...value, [key]: nextValue }) }
  const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400/30'
  return <div className="space-y-3">
    <section className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 sm:p-4">
      <p className="m-0 text-sm font-medium">ระบบเติมให้อัตโนมัติจากสัญญา</p>
      <p className="mb-0 mt-1 text-xs leading-5 text-slate-600">ชื่อคู่สัญญา เลขสัญญา เงินต้น ดอกเบี้ยตามรอบสัญญา และวันครบกำหนดจะดึงจาก 3.1 ส่วนผู้ค้ำประกันดึงจาก 3.2 ระบบคำนวณอัตราเทียบรายปีและตรวจเพดานการให้กู้ทั่วไปก่อนบันทึก</p>
    </section>
    <label className="block text-sm font-medium">ใช้บัญชีแนบท้าย
      <select value={value.assetAccount ?? 'BOTH'} onChange={event => update('assetAccount', event.target.value)} className={fieldClass}>
        <option value="MORTGAGE">บัญชี ก · อสังหาริมทรัพย์ / จำนอง</option><option value="PLEDGE">บัญชี ข · สังหาริมทรัพย์ / จำนำ</option><option value="BOTH">ใช้ทั้งบัญชี ก และ ข</option>
      </select>
    </label>
    {sections.filter((_, sectionIndex) => sectionIndex === 0 || value.assetAccount === 'BOTH' || value.assetAccount === 'MORTGAGE' && sectionIndex === 1 || value.assetAccount === 'PLEDGE' && sectionIndex === 2).map((section, sectionIndex) => <details key={section.title} open={sectionIndex === 0} className="rounded-xl border border-slate-200 bg-white/50 p-3 sm:p-4">
      <summary className="cursor-pointer text-sm font-semibold">{section.title}</summary>
      {section.description && <p className="mb-0 mt-1 text-xs text-slate-500">{section.description}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{section.fields.map(field => <label key={field.key} htmlFor={`${id}-${field.key}`} className={`min-w-0 text-xs font-medium text-slate-700 ${field.kind === 'textarea' ? 'sm:col-span-2' : ''}`}>
        {field.label}
        {field.kind === 'textarea' ? <textarea id={`${id}-${field.key}`} value={value[field.key] ?? ''} onChange={event => update(field.key, event.target.value)} maxLength={1000} rows={2} className={fieldClass} placeholder={field.placeholder} /> : field.kind === 'select' ? <select id={`${id}-${field.key}`} value={value[field.key] ?? ''} onChange={event => update(field.key, event.target.value)} className={fieldClass}><option value="">เลือกฐานะ</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={`${id}-${field.key}`} type={field.kind ?? 'text'} inputMode={field.kind === 'number' ? 'decimal' : undefined} value={value[field.key] ?? ''} onChange={event => update(field.key, event.target.value)} maxLength={field.kind === 'number' || field.kind === 'date' ? undefined : 500} className={fieldClass} placeholder={field.placeholder} />}
      </label>)}</div>
    </details>)}
  </div>
}
