'use client'

import { useState } from 'react'
import { money, today, type Home } from '@/app/thing/_shared/model'

const control = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300/30 bg-white px-3 text-sm'

export function readLandFields(form: FormData): Pick<Home, 'purchasePrice' | 'purchasedOn' | 'landValue' | 'landDetails'> {
  const text = (key: string) => String(form.get(key) ?? '').trim()
  const number = (key: string) => Number(text(key))
  return {
    purchasePrice: number('landPurchasePrice'), purchasedOn: text('landPurchasedOn'), landValue: number('landCurrentValue'),
    landDetails: { deedNumber: text('deedNumber'), areaSquareWa: Math.round((number('landAreaRai') * 400 + number('landAreaNgan') * 100 + number('landAreaWa')) * 100) / 100, valuationOn: text('landValuationOn'), valuationSource: text('landValuationSource'), priceType: text('landPriceType') as 'appraisal' | 'asking' | 'sale', priceNotes: text('landPriceNotes') },
  }
}

export function LandDetailsFields({ initial, busy }: { initial: Home | null; busy: boolean }) {
  const details = initial?.landDetails
  const areaHundredths = Math.round((details?.areaSquareWa ?? 0) * 100)
  const rai = Math.floor(areaHundredths / 40000)
  const ngan = Math.floor((areaHundredths % 40000) / 10000)
  const wa = (areaHundredths % 10000) / 100
  const [areaRai, setAreaRai] = useState(rai ? String(rai) : '')
  const [areaNgan, setAreaNgan] = useState(ngan ? String(ngan) : '')
  const [areaWa, setAreaWa] = useState(wa ? String(wa) : '')
  const hasArea = [areaRai, areaNgan, areaWa].some(value => value !== '')
  const validArea = Number.isInteger(Number(areaRai)) && Number(areaRai) >= 0 && Number(areaRai) <= 2500000000 && Number.isInteger(Number(areaNgan)) && Number(areaNgan) >= 0 && Number(areaNgan) <= 3 && Number.isFinite(Number(areaWa)) && Number(areaWa) >= 0 && Number(areaWa) <= 99.99
  const totalWa = Math.round((Number(areaRai) * 400 + Number(areaNgan) * 100 + Number(areaWa)) * 100) / 100
  const formatArea = (value: number) => value.toLocaleString('th-TH', { maximumFractionDigits: 2 })
  const [purchase, setPurchase] = useState(initial?.purchasePrice ? String(initial.purchasePrice) : '')
  const [current, setCurrent] = useState(initial?.landValue ? String(initial.landValue) : '')
  return <fieldset disabled={busy} className="space-y-4 rounded-xl border border-slate-300/30 p-4">
    <legend className="px-1 text-sm font-semibold">รายละเอียดและราคาที่ดิน</legend>
    <label className="block text-xs font-medium">เลขโฉนด<input name="deedNumber" defaultValue={details?.deedNumber ?? ''} maxLength={3000} className={control} /></label>
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium">เนื้อที่</legend>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-xs font-medium">ไร่<input name="landAreaRai" type="number" min="0" max="2500000000" step="1" value={areaRai} onChange={e => setAreaRai(e.target.value)} className={control} /></label>
        <label className="block text-xs font-medium">งาน<input name="landAreaNgan" type="number" min="0" max="3" step="1" value={areaNgan} onChange={e => setAreaNgan(e.target.value)} className={control} /></label>
        <label className="block text-xs font-medium">ตารางวา<input name="landAreaWa" type="number" min="0" max="99.99" step=".01" value={areaWa} onChange={e => setAreaWa(e.target.value)} className={control} /></label>
      </div>
      <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-6 text-emerald-900">
        <p className="m-0 font-medium">พื้นที่รวม</p>
        {hasArea && validArea ? <><p className="m-0">{formatArea(Number(areaRai))} ไร่ {formatArea(Number(areaNgan))} งาน {formatArea(Number(areaWa))} ตารางวา</p><p className="m-0">{formatArea(totalWa)} ตารางวา · {formatArea(totalWa * 4)} ตารางเมตร</p></> : <p className="m-0">{hasArea ? 'กรุณาระบุเนื้อที่ให้ถูกต้อง' : 'กรอกเนื้อที่เพื่อแสดงพื้นที่รวม'}</p>}
      </div>
      <p className="m-0 text-[11px] text-slate-500">1 ไร่ = 4 งาน · 1 งาน = 100 ตารางวา</p>
    </fieldset>
    <label className="block text-xs font-medium">ราคาซื้อที่ดิน (บาท)<input name="landPurchasePrice" type="number" min="0" max="1000000000000" step=".01" value={purchase} onChange={e => setPurchase(e.target.value)} className={control} /></label>
    <label className="block text-xs font-medium">วันที่ซื้อ<input name="landPurchasedOn" type="date" max={today()} defaultValue={initial?.purchasedOn ?? ''} className={control} /></label>
    <label className="block text-xs font-medium">ประเภทราคา<select name="landPriceType" defaultValue={details?.priceType ?? 'appraisal'} className={control}><option value="appraisal">ราคาประเมิน</option><option value="asking">ราคาตั้งขาย</option><option value="sale">ราคาขายจริง</option></select></label>
    <p className="text-xs text-slate-500">ระบุราคาที่ประเมินหรือสอบถามมา ระบบเก็บประวัติเมื่อบันทึกราคา วันที่ หรือแหล่งข้อมูลใหม่</p>
    <label className="block text-xs font-medium">ราคาที่บันทึก (บาท)<input name="landCurrentValue" type="number" min="0" max="1000000000000" step=".01" value={current} onChange={e => setCurrent(e.target.value)} className={control} /></label>
    <label className="block text-xs font-medium">วันที่ของราคา{Number(current) > 0 ? ' *' : ''}<input name="landValuationOn" type="date" max={today()} required={Number(current) > 0} defaultValue={details?.valuationOn ?? ''} className={control} /></label>
    <label className="block text-xs font-medium">แหล่งข้อมูล{Number(current) > 0 ? ' *' : ''}<input name="landValuationSource" required={Number(current) > 0} placeholder="เช่น ประเมินเอง / ราคาประเมินจากเอกสาร" maxLength={3000} defaultValue={details?.valuationSource ?? ''} className={control} /></label>
    <label className="block text-xs font-medium">หมายเหตุ<textarea name="landPriceNotes" defaultValue={details?.priceNotes ?? ''} maxLength={3000} className={control} /></label>
    {details?.priceHistory?.length ? <div className="border-t border-slate-200 pt-4"><h3 className="text-sm font-semibold">ประวัติราคาที่บันทึก</h3>{[...details.priceHistory].reverse().map((row, index) => <div key={index} className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-6"><p>{row.date} · {({ appraisal: 'ราคาประเมิน', asking: 'ราคาตั้งขาย', sale: 'ราคาขายจริง' })[row.type]} · {money(row.amount)} บาท</p><p>แหล่งข้อมูล: {row.source}</p>{row.notes ? <p>{row.notes}</p> : null}</div>)}</div> : null}
  </fieldset>
}
