'use client'

import { useState } from 'react'
import { money, today, type Home, type LandPriceType } from '@/app/thing/_shared/model'
import { Button } from '@/components/ui/button'

const control = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300/30 bg-white px-3 text-sm'

export function readLandFields(form: FormData): Pick<Home, 'purchasePrice' | 'purchasedOn' | 'landValue' | 'landDetails' | 'address'> {
  const text = (key: string) => String(form.get(key) ?? '').trim()
  const number = (key: string) => Number(text(key))
  const optionalNumber = (key: string) => text(key) === '' ? undefined : number(key)
  return {
    address: text('landAddress'), purchasePrice: number('landPurchasePrice'), purchasedOn: text('landPurchasedOn'), landValue: number('landCurrentValue'),
    landDetails: { purchaseContractPrice: optionalNumber('landPurchaseContractPrice'), transferBuyerShare: optionalNumber('landTransferBuyerShare'), purchaseNotes: text('landPurchaseNotes'), deedNumber: text('deedNumber'), areaSquareWa: Math.round((number('landAreaRai') * 400 + number('landAreaNgan') * 100 + number('landAreaWa')) * 100) / 100, valuationOn: text('landValuationOn'), valuationSource: text('landValuationSource'),
      titleType: text('landTitleType'), parcelNo: text('landParcelNo'), surveyNo: text('landSurveyNo'), mapSheet: text('landMapSheet'), mapScale: text('landMapScale'), titleBook: text('landTitleBook'), titlePage: text('landTitlePage'),
      village: text('landVillage'), moo: text('landMoo'), subdistrict: text('landSubdistrict'), district: text('landDistrict'), province: text('landProvince'), postalCode: text('landPostalCode'), landOffice: text('landOffice'),
      latitude: optionalNumber('landLatitude'), longitude: optionalNumber('landLongitude'), landUse: text('landUse'), zoning: text('landZoning'), roadAccess: text('landRoadAccess'), utilitiesNotes: text('landUtilitiesNotes'), notes: text('landNotes'),
      priceType: text('landPriceType') as LandPriceType, priceNotes: text('landPriceNotes') },
  }
}

export function LandDetailsFields({ initial, busy, priceOnly = false }: { initial: Home | null; busy: boolean; priceOnly?: boolean }) {
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
  const [priceDate, setPriceDate] = useState(priceOnly ? today() : details?.valuationOn ?? '')
  const [priceSource, setPriceSource] = useState(priceOnly ? '' : details?.valuationSource ?? '')
  const [priceNotes, setPriceNotes] = useState(priceOnly ? '' : details?.priceNotes ?? '')
  const [priceType, setPriceType] = useState<LandPriceType>(priceOnly ? 'market_appraisal' : details?.priceType ?? 'market_appraisal')
  const titleFields = [
    ['ประเภทเอกสารสิทธิ', 'landTitleType', details?.titleType],
    ['เลขที่ดิน', 'landParcelNo', details?.parcelNo],
    ['หน้าสำรวจ', 'landSurveyNo', details?.surveyNo],
    ['ระวาง', 'landMapSheet', details?.mapSheet],
    ['มาตราส่วนระวาง', 'landMapScale', details?.mapScale],
    ['เล่ม', 'landTitleBook', details?.titleBook],
    ['หน้า', 'landTitlePage', details?.titlePage],
  ] as const
  const locationFields = [
    ['หมู่บ้าน', 'landVillage', details?.village],
    ['หมู่', 'landMoo', details?.moo],
    ['ตำบล / แขวง', 'landSubdistrict', details?.subdistrict],
    ['อำเภอ / เขต', 'landDistrict', details?.district],
    ['จังหวัด', 'landProvince', details?.province],
    ['รหัสไปรษณีย์', 'landPostalCode', details?.postalCode],
    ['สำนักงานที่ดิน', 'landOffice', details?.landOffice],
  ] as const
  function startNewAppraisal() {
    setCurrent('')
    setPriceDate(today())
    setPriceSource('')
    setPriceNotes('')
    setPriceType('market_appraisal')
  }
  return <fieldset disabled={busy} className="space-y-4 rounded-xl border border-slate-300/30 p-4">
    <legend className="px-1 text-sm font-semibold">รายละเอียดและราคาที่ดิน</legend><input type="hidden" name="landPurchaseContractPrice" value={details?.purchaseContractPrice ?? ''} /><input type="hidden" name="landTransferBuyerShare" value={details?.transferBuyerShare ?? ''} /><input type="hidden" name="landPurchaseNotes" value={details?.purchaseNotes ?? ''} />
    {!priceOnly ? <label className="block text-xs font-medium">เลขโฉนด<input name="deedNumber" defaultValue={details?.deedNumber ?? ''} maxLength={3000} className={control} /></label> : null}
    {!priceOnly ? <details className="rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-xs font-semibold">เอกสารสิทธิและที่ตั้งเพิ่มเติม</summary>
      <div className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">{titleFields.map(([label, name, value]) => <label className="block text-xs font-medium" key={name}>{label}<input name={name} defaultValue={value ?? ''} maxLength={3000} className={control} /></label>)}</div>
        <label className="block text-xs font-medium">ที่อยู่<input name="landAddress" defaultValue={initial?.address ?? ''} maxLength={3000} className={control} /></label>
        <div className="grid gap-3 sm:grid-cols-2">{locationFields.map(([label, name, value]) => <label className="block text-xs font-medium" key={name}>{label}<input name={name} defaultValue={value ?? ''} maxLength={3000} className={control} /></label>)}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium">ละติจูด<input name="landLatitude" type="number" min="-90" max="90" step=".0000001" defaultValue={details?.latitude ?? ''} className={control} /></label>
          <label className="block text-xs font-medium">ลองจิจูด<input name="landLongitude" type="number" min="-180" max="180" step=".0000001" defaultValue={details?.longitude ?? ''} className={control} /></label>
        </div>
        <label className="block text-xs font-medium">การใช้ประโยชน์ที่ดิน<input name="landUse" defaultValue={details?.landUse ?? ''} maxLength={3000} placeholder="เช่น อยู่อาศัย / เกษตรกรรม" className={control} /></label>
        <label className="block text-xs font-medium">ผังเมือง / ข้อกำหนดการใช้พื้นที่<input name="landZoning" defaultValue={details?.zoning ?? ''} maxLength={3000} className={control} /></label>
        <label className="block text-xs font-medium">ทางเข้าและถนน<input name="landRoadAccess" defaultValue={details?.roadAccess ?? ''} maxLength={3000} className={control} /></label>
        <label className="block text-xs font-medium">สาธารณูปโภค<textarea name="landUtilitiesNotes" defaultValue={details?.utilitiesNotes ?? ''} maxLength={3000} className={control} /></label>
        <label className="block text-xs font-medium">หมายเหตุเกี่ยวกับที่ดิน<textarea name="landNotes" defaultValue={details?.notes ?? ''} maxLength={3000} className={control} /></label>
      </div>
    </details> : null}
    {!priceOnly ? <fieldset className="space-y-2">
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
    </fieldset> : null}
    {!priceOnly ? <><label className="block text-xs font-medium">ราคาซื้อที่ดิน (บาท)<input name="landPurchasePrice" type="number" min="0" max="1000000000000" step=".01" value={purchase} onChange={e => setPurchase(e.target.value)} className={control} /></label>
    <label className="block text-xs font-medium">วันที่ซื้อ<input name="landPurchasedOn" type="date" max={today()} defaultValue={initial?.purchasedOn ?? ''} className={control} /></label></> : null}
    {!priceOnly ? <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs leading-6">
          <p className="m-0 font-semibold">ราคาที่บันทึกล่าสุด</p>
          <p className="m-0">{Number(current) > 0 ? `${money(Number(current))} บาท${priceDate ? ` · ${priceDate}` : ''}` : 'ยังไม่มีราคาประเมิน'}</p>
        </div>
        <Button disabled={busy} onClick={startNewAppraisal}>เพิ่มการประเมินราคา</Button>
      </div>
      <p className="mb-0 mt-2 text-[11px] leading-5 text-slate-600">กรอกราคาและข้อมูลประเมินรอบใหม่ แล้วกดบันทึกสินทรัพย์เพื่อเก็บประวัติ</p>
    </div> : <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs leading-6"><p className="m-0 font-semibold">ราคาล่าสุด: {Number(initial?.landValue) > 0 ? `${money(initial!.landValue)} บาท${details?.valuationOn ? ` · ${details.valuationOn}` : ''}` : 'ยังไม่มีราคาประเมิน'}</p><p className="mb-0 mt-1">ราคาที่บันทึกก่อนหน้าจะถูกเก็บไว้ในประวัติ</p></div>}
    <label className="block text-xs font-medium">ประเภทราคา<select name="landPriceType" value={priceType} onChange={e => setPriceType(e.target.value as LandPriceType)} className={control}><option value="market_appraisal">ราคาประเมินตลาด</option><option value="official_appraisal">ราคาประเมินราชการ</option><option value="asking">ราคาตั้งขาย</option><option value="sale">ราคาขายจริง</option>{details?.priceType === 'appraisal' ? <option value="appraisal">ราคาประเมินเดิม</option> : null}</select></label>
    <label className="block text-xs font-medium">ราคาประเมิน / ราคาขาย (บาท)<input name="landCurrentValue" type="number" min="0" max="1000000000000" step=".01" required={priceOnly} value={current} onChange={e => setCurrent(e.target.value)} className={control} /></label>
    <label className="block text-xs font-medium">วันที่ประเมิน / วันที่ขาย{Number(current) > 0 ? ' *' : ''}<input name="landValuationOn" type="date" max={today()} required={Number(current) > 0} value={priceDate} onChange={e => setPriceDate(e.target.value)} className={control} /></label>
    <label className="block text-xs font-medium">แหล่งข้อมูล{Number(current) > 0 ? ' *' : ''}<input name="landValuationSource" required={Number(current) > 0} placeholder="เช่น ประเมินเอง / ราคาประเมินจากเอกสาร" maxLength={3000} value={priceSource} onChange={e => setPriceSource(e.target.value)} className={control} /></label>
    <label className="block text-xs font-medium">หมายเหตุ<textarea name="landPriceNotes" value={priceNotes} onChange={e => setPriceNotes(e.target.value)} maxLength={3000} className={control} /></label>
    {details?.priceHistory?.length ? <div className="border-t border-slate-200 pt-4"><h3 className="text-sm font-semibold">ประวัติราคาที่บันทึก</h3>{[...details.priceHistory].reverse().map((row, index) => <div key={index} className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-6"><p>{row.date} · {({ appraisal: 'ราคาประเมินเดิม', official_appraisal: 'ราคาประเมินราชการ', market_appraisal: 'ราคาประเมินตลาด', asking: 'ราคาตั้งขาย', sale: 'ราคาขายจริง' })[row.type]} · {money(row.amount)} บาท</p><p>แหล่งข้อมูล: {row.source}</p>{row.notes ? <p>{row.notes}</p> : null}</div>)}</div> : null}
  </fieldset>
}
