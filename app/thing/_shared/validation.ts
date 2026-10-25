import { balance, roundMoney, today, propertyAssetIds, propertyTypes, propertyStatuses, propertyAddressFields, type AssetData } from './model'

export function validateAssetData(data: AssetData) {
  const fail = (message: string): never => { throw new Error(message) }
  const text = (value: unknown) => typeof value === 'string' && value.length <= 3000 || fail('ข้อความไม่ถูกต้องหรือยาวเกินไป')
  const amount = (value: unknown, positive = false) => typeof value === 'number' && Number.isFinite(value) && value >= (positive ? .000001 : 0) && value <= 1e12 || fail('จำนวนเงินหรือจำนวนรายการไม่ถูกต้อง')
  const date = (value: string, optional = false) => optional && value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value || fail('กรุณาระบุวันที่ให้ถูกต้อง')
  const ids = new Set<string>()
  const id = (value: string) => { text(value); if (!/^[a-zA-Z0-9-]{1,80}$/.test(value) || ids.has(value)) fail('รหัสรายการซ้ำหรือไม่ถูกต้อง'); ids.add(value) }
  if (!data || data.version !== 2 || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Array.isArray(data.homes) || data.homes.length < 1 || data.homes.length > 100) fail('ข้อมูลสินทรัพย์ไม่ถูกต้อง')
  for (const home of data.homes) {
    id(home.id); text(home.name); text(home.address); text(home.categoryCode)
    if (home.archivedOn !== undefined) { date(home.archivedOn); if (home.archivedOn > today()) fail('วันที่ลบต้องไม่เป็นอนาคต') }
    if (!home.name.trim()) fail('กรุณาระบุชื่อบ้าน')
    if (!['house', 'vehicle', 'other'].includes(home.kind) || !['cash', 'loan'].includes(home.financing)) fail('ประเภทสินทรัพย์หรือการชำระไม่ถูกต้อง')
    if (home.vehicleType !== undefined && (home.kind !== 'vehicle' || !['car', 'pickup', 'sedan', 'other'].includes(home.vehicleType))) fail('ประเภทรถไม่ถูกต้อง')
    if (home.vehicleDetails !== undefined) {
      if (home.kind !== 'vehicle') fail('รายละเอียดรถใช้กับสินทรัพย์ประเภทยานพาหนะเท่านั้น')
      const vehicle = home.vehicleDetails
      for (const value of [vehicle.brand, vehicle.model, vehicle.variant, vehicle.plateNumber, vehicle.plateProvince, vehicle.vin, vehicle.engineNumber, vehicle.color, vehicle.fuelType, vehicle.transmission, vehicle.purchaseSeller ?? '', vehicle.purchaseReference ?? '']) text(value)
      amount(vehicle.modelYear); amount(vehicle.engineCc); amount(vehicle.odometerKm)
      if (vehicle.modelYear && (!Number.isInteger(vehicle.modelYear) || vehicle.modelYear < 1900 || vehicle.modelYear > new Date().getFullYear() + 1)) fail('ปีรถไม่ถูกต้อง')
      if (!Number.isInteger(vehicle.engineCc) || !Number.isInteger(vehicle.odometerKm)) fail('ขนาดเครื่องยนต์และเลขไมล์ต้องเป็นจำนวนเต็ม')
    }
    if (home.vehicleRecords !== undefined) {
      if (!Array.isArray(home.vehicleRecords) || home.vehicleRecords.length > 10000 || home.kind !== 'vehicle') fail('รายการยานพาหนะไม่ถูกต้อง')
      for (const record of home.vehicleRecords) {
        id(record.id); text(record.name); text(record.category); text(record.vendor); text(record.replacesId); text(record.reference); text(record.notes)
        if (!record.name.trim() || !['maintenance', 'repair', 'component', 'customization', 'insurance', 'tax'].includes(record.type) || !['active', 'removed', 'disposed'].includes(record.status)) fail('ประเภทรายการรถไม่ถูกต้อง')
        date(record.date); date(record.warrantyUntil, true); date(record.expiresOn, true)
        amount(record.odometerKm); amount(record.partsCost); amount(record.laborCost)
        if (!Number.isInteger(record.odometerKm) || record.type !== 'component' && record.type !== 'customization' && record.status !== 'active' || record.type !== 'insurance' && record.type !== 'tax' && record.expiresOn) fail('รายละเอียดรายการรถไม่ถูกต้อง')
      }
    }
    if (home.vehicleValuations !== undefined) {
      if (!Array.isArray(home.vehicleValuations) || home.vehicleValuations.length > 10000 || home.kind !== 'vehicle') fail('ประวัติมูลค่ารถไม่ถูกต้อง')
      for (const valuation of home.vehicleValuations) { id(valuation.id); date(valuation.date); amount(valuation.amount, true); text(valuation.source); text(valuation.notes); if (valuation.date > today() || !valuation.source.trim()) fail('ประวัติประเมินรถไม่ถูกต้อง') }
    }
    amount(home.purchasePrice); date(home.purchasedOn, true)
    if (!['manual', 'boq'].includes(home.costSource) || home.costSource === 'boq' && home.kind !== 'house') fail('แหล่งต้นทุนไม่ถูกต้อง')
    if (home.kind !== 'house' && home.landValue !== 0) fail('มูลค่าที่ดินใช้เฉพาะอสังหาริมทรัพย์')
    amount(home.landValue); amount(home.buildingValue)
    if (home.landDetails !== undefined) {
      const land = home.landDetails
      if (!land || home.kind !== 'house') fail('รายละเอียดที่ดินใช้กับอสังหาริมทรัพย์เท่านั้น')
      text(land.deedNumber); amount(land.areaSquareWa); date(land.valuationOn, true); text(land.valuationSource)
      for (const value of [land.titleType, land.parcelNo, land.surveyNo, land.mapSheet, land.mapScale, land.titleBook, land.titlePage, land.village, land.moo, land.subdistrict, land.district, land.province, land.postalCode, land.landOffice, land.landUse, land.zoning, land.roadAccess, land.utilitiesNotes, land.notes]) if (value !== undefined) text(value)
      if (land.latitude !== undefined && (!Number.isFinite(land.latitude) || land.latitude < -90 || land.latitude > 90)) fail('ละติจูดต้องอยู่ระหว่าง -90 ถึง 90')
      if (land.longitude !== undefined && (!Number.isFinite(land.longitude) || land.longitude < -180 || land.longitude > 180)) fail('ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180')
      if (land.valuationOn > today() || home.purchasedOn > today()) fail('วันที่ซื้อและวันที่ประเมินต้องไม่เป็นอนาคต')
      if (home.landValue > 0 && (!land.valuationOn || !land.valuationSource.trim())) fail('กรุณาระบุวันที่และแหล่งประเมินราคาที่ดิน')
      if (land.priceType !== undefined && !['appraisal', 'official_appraisal', 'market_appraisal', 'asking', 'sale'].includes(land.priceType)) fail('ประเภทราคาไม่ถูกต้อง')
      if (land.priceNotes !== undefined) text(land.priceNotes)
      if (land.priceHistory !== undefined) {
        if (!Array.isArray(land.priceHistory) || land.priceHistory.length > 10000) fail('ประวัติราคาไม่ถูกต้อง')
        for (const row of land.priceHistory) {
          amount(row.amount, true); date(row.date); text(row.source); text(row.notes)
          if (!row.source.trim() || row.date > today() || !['appraisal', 'official_appraisal', 'market_appraisal', 'asking', 'sale'].includes(row.type)) fail('ประวัติราคาไม่ถูกต้อง')
        }
      }
    }
    if (home.landDevelopments !== undefined) {
      if (!Array.isArray(home.landDevelopments) || home.landDevelopments.length > 2000 || !home.landDetails && home.landDevelopments.length > 0) fail('รายการงานภายนอกต้องผูกกับทะเบียนที่ดิน')
      for (const work of home.landDevelopments) {
        id(work.id); text(work.name); text(work.description); text(work.unit); text(work.vendor); text(work.reference); text(work.beforePhotoRef); text(work.afterPhotoRef)
        if (!work.name.trim() || !['site_clearing', 'fill_compaction', 'wall_fence', 'gate', 'road_concrete', 'permanent_garage', 'drainage', 'utilities', 'landscape', 'planted_tree', 'garden_light', 'repair_maintenance', 'service', 'other'].includes(work.type)) fail('ประเภทงานภายนอกไม่ถูกต้อง')
        if (['repair_maintenance', 'service'].includes(work.type) && work.treatment !== 'expense') fail('งานซ่อมบำรุงและบริการต้องบันทึกเป็นค่าใช้จ่าย ไม่รวมในต้นทุนสินทรัพย์')
        if (!['fixed_to_land', 'fixed_to_building', 'detachable', 'movable'].includes(work.mobility) || !['planned', 'approved', 'in_progress', 'completed', 'maintenance', 'retired', 'cancelled'].includes(work.status)) fail('สถานะหรือการเคลื่อนย้ายงานไม่ถูกต้อง')
        if (!['capital', 'expense'].includes(work.treatment) || !['quantity', 'lump_sum'].includes(work.pricingMode) || !['contract_lump_sum', 'labor_plus_materials', 'materials_self'].includes(work.costMethod)) fail('วิธีคิดราคา/ประเภทต้นทุนไม่ถูกต้อง')
        for (const value of [work.quantity, work.unitPrice, work.lumpSum, work.laborCost, work.contractPrice, work.laborAmount, work.areaRai, work.areaNgan, work.areaSquareWah, work.fillHeightMeters, work.areaSquareMeters, work.lengthMeters, work.heightMeters, work.depthMeters, work.volumeCubicMeters, work.budget, work.actualCost, work.recognizedAssetValue]) amount(value)
        if (!Number.isInteger(work.areaRai) || !Number.isInteger(work.areaNgan) || work.areaNgan > 3 || work.areaSquareWah >= 100) fail('เนื้อที่ไร่ งาน หรือตารางวาไม่ถูกต้อง')
        const materialsCost = work.materials.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0)
        const expectedBudget = work.costMethod === 'contract_lump_sum' ? work.contractPrice : work.costMethod === 'labor_plus_materials' ? work.laborAmount + materialsCost : materialsCost
        if (Math.abs(Math.round(expectedBudget * 100) - Math.round(work.budget * 100)) > 1) fail('ยอดรวมต้นทุนไม่ตรงกับวิธีคิดราคา')
        if (work.costMethod === 'materials_self' && work.laborAmount > 0) fail('รายการวัสดุทำเองไม่ควรมีค่าแรง')
        if (work.treatment === 'expense' && work.recognizedAssetValue > 0 || work.recognizedAssetValue > 0 && work.status !== 'completed') fail('บำรุงรักษาหรือเงินที่ยังไม่ส่งมอบงานห้ามรับรู้เป็นมูลค่าสินทรัพย์')
        if (work.recognizedAssetValue > work.actualCost) fail('มูลค่าสินทรัพย์ที่รับรู้ต้องไม่เกินต้นทุนจริง')
        if (work.resultingAssetId && !data.homes.some(asset => asset.id === work.resultingAssetId && asset.id !== home.id)) fail('ไม่พบสินทรัพย์ที่เกิดจากงานพัฒนา')
        date(work.startedOn, true); date(work.completedOn, true); date(work.warrantyUntil, true)
        if (work.completedOn && work.startedOn && work.completedOn < work.startedOn) fail('วันเสร็จงานต้องไม่ก่อนวันเริ่มงาน')
        if (work.boq.length > 500 || work.maintenance.length > 2000) fail('รายการ BOQ หรือประวัติซ่อมบำรุงมากเกินไป')
        if (!Array.isArray(work.materials) || work.materials.length > 1000 || !Array.isArray(work.documentRefs) || work.documentRefs.length > 1000) fail('รายการวัสดุหรือเอกสารมากเกินไป')
        for (const row of work.materials) { id(row.id); text(row.name); text(row.unit); amount(row.quantity, true); amount(row.unitPrice); if (!row.name.trim()) fail('กรุณาระบุชื่อวัสดุ') }
        for (const row of work.documentRefs) { id(row.id); text(row.name); text(row.reference); if (!row.name.trim() || !row.reference.trim()) fail('ชื่อเอกสารและที่อ้างอิงต้องไม่ว่าง') }
        for (const line of work.boq) { id(line.id); text(line.name); text(line.specification); text(line.unit); text(line.vendor); text(line.reference); amount(line.quantity); amount(line.materialCost); amount(line.laborCost); amount(line.paid); if (!line.name.trim()) fail('กรุณาระบุชื่อรายการ BOQ') }
        for (const record of work.maintenance) { id(record.id); date(record.date); text(record.description); text(record.vendor); text(record.reference); amount(record.cost); if (!record.description.trim() || record.date > today()) fail('ประวัติซ่อมบำรุงไม่ถูกต้อง') }
        if (work.actualCostHistory !== undefined) {
          if (!Array.isArray(work.actualCostHistory) || work.actualCostHistory.length > 10000) fail('ประวัติต้นทุนจริงไม่ถูกต้อง')
          for (const record of work.actualCostHistory) { id(record.id); date(record.date); amount(record.amount, true); text(record.note); if (record.date > today()) fail('วันที่บันทึกต้นทุนจริงต้องไม่เป็นอนาคต') }
        }
        if (!Array.isArray(work.payments) || work.payments.length > 10000) fail('ประวัติธุรกรรมไม่ถูกต้อง')
        for (const payment of work.payments) { const direction = payment.direction ?? 'OUT'; id(payment.id); date(payment.date); amount(payment.amount, true); text(payment.reference); text(payment.note); if (!Number.isSafeInteger(payment.ledgerEntryId) || payment.ledgerEntryId < 1 || payment.date > today() || !['deposit', 'progress', 'final', 'maintenance', 'refund'].includes(payment.type) || payment.direction !== undefined && !['IN', 'OUT'].includes(payment.direction) || direction === 'IN' && payment.type !== 'refund' || direction === 'OUT' && payment.type === 'refund') fail('ธุรกรรมรับ–จ่ายงานพัฒนาไม่ถูกต้อง') }
      }
    }
    for (const key of ['rooms', 'items', 'boq'] as const) if (!Array.isArray(home[key]) || home[key].length > 10000) fail('รายการมากเกินไป')
    home.rooms.forEach(r => { text(r); if (!r.trim()) fail('ชื่อห้องว่าง') })
    if (new Set(home.rooms).size !== home.rooms.length) fail('ชื่อห้องซ้ำ')
    for (const item of home.items) {
      id(item.id); [item.room, item.name, item.size, item.shop, item.notes].forEach(text)
      if (!item.name.trim() || !home.rooms.includes(item.room)) fail('กรุณาระบุชื่อสินค้าและห้อง')
      amount(item.quantity, true); amount(item.price); date(item.purchasedOn, true); date(item.warrantyUntil, true)
      date(item.warrantyStart, true); amount(item.warrantyMonths)
      if (!Number.isInteger(item.warrantyMonths) || item.warrantyMonths > 1200) fail('ระยะประกันไม่ถูกต้อง')
      if (item.warrantyStart && item.warrantyUntil && item.warrantyUntil < item.warrantyStart) fail('วันสิ้นสุดประกันต้องไม่ก่อนวันเริ่มประกัน')
      if (item.purchasedOn && item.warrantyUntil && item.warrantyUntil < item.purchasedOn) fail('วันหมดประกันต้องไม่ก่อนวันซื้อ')
      if (item.serial !== undefined) text(item.serial)
      if (item.status !== undefined && !['active', 'repair', 'removed', 'sold', 'retired'].includes(item.status)) fail('สถานะอุปกรณ์ไม่ถูกต้อง')
      if (item.includedInMainCost !== undefined && typeof item.includedInMainCost !== 'boolean') fail('การรวมราคาสินทรัพย์ไม่ถูกต้อง')
      if (item.boqId && !home.boq.some(b => b.id === item.boqId)) fail('ไม่พบรายการ BOQ ของอุปกรณ์')
      if (item.events !== undefined) {
        if (!Array.isArray(item.events) || item.events.length > 10000) fail('ประวัติอุปกรณ์ไม่ถูกต้อง')
        for (const event of item.events) { date(event.date); text(event.from); text(event.to); text(event.status) }
      }
    }
    for (const item of home.boq) {
      id(item.id); [item.category, item.subcategory ?? '', item.name, item.spec, item.unit, item.vendor, item.reference].forEach(text)
      if (!item.name.trim()) fail('กรุณาระบุชื่อรายการ BOQ')
      amount(item.quantity, true); [item.price, item.labor, item.paid].forEach(n => amount(n))
      if (item.ledgerEntryId !== undefined && (!Number.isSafeInteger(item.ledgerEntryId) || item.ledgerEntryId < 1)) fail('เลขรายการบัญชีไม่ถูกต้อง')
      if (item.scope !== undefined && !['construction', 'builtin'].includes(item.scope)) fail('ประเภท BOQ ไม่ถูกต้อง')
      if (item.room && !home.rooms.includes(item.room)) fail('ห้องใน BOQ ไม่ถูกต้อง')
      if (item.cancelled !== undefined && typeof item.cancelled !== 'boolean') fail('สถานะ BOQ ไม่ถูกต้อง')
      if (item.replacesId) {
        const previous = home.boq.find(b => b.id === item.replacesId)
        if (!previous || previous.id === item.id || !previous.cancelled) fail('รายการ BOQ ที่ถูกแทนต้องอยู่ในบ้านเดียวกันและยกเลิกงบเดิมแล้ว')
        const visited = new Set([item.id]); let cursor: typeof previous | undefined = previous
        while (cursor) { if (visited.has(cursor.id)) fail('การแทนที่ BOQ วนซ้ำ'); visited.add(cursor.id); cursor = home.boq.find(b => b.id === cursor!.replacesId) }
      }
    }
    if (home.buildingDetails !== undefined) {
      const details = home.buildingDetails
      if (home.kind !== 'house') fail('ข้อมูลอาคารใช้กับสินทรัพย์บ้านเท่านั้น')
      amount(details.usableAreaSqm); amount(details.floorCount); text(details.buildingType); text(details.notes); date(details.completedOn, true)
      if (!Number.isInteger(details.floorCount)) fail('จำนวนชั้นต้องเป็นจำนวนเต็ม')
      if (details.completedOn && details.completedOn > today()) fail('วันที่สร้างเสร็จต้องไม่เป็นอนาคต')
      if (details.roomCounts !== undefined) {
        if (!Array.isArray(details.roomCounts) || details.roomCounts.length > 500 || new Set(details.roomCounts.map(row => row.name)).size !== details.roomCounts.length) fail('จำนวนห้องไม่ถูกต้อง')
        for (const row of details.roomCounts) { text(row.name); amount(row.count); if (!row.name.trim() || !home.rooms.includes(row.name) || !Number.isInteger(row.count) || row.count < 1) fail('ชื่อและจำนวนห้องไม่ถูกต้อง') }
      }
    }
    if (home.buildingWorks !== undefined) {
      if (home.kind !== 'house' || !Array.isArray(home.buildingWorks) || home.buildingWorks.length > 10000) fail('รายการจัดการบ้านไม่ถูกต้อง')
      for (const work of home.buildingWorks) {
        id(work.id); text(work.name); text(work.vendor); text(work.reference); text(work.notes); date(work.date); date(work.warrantyUntil, true); amount(work.amount)
        if (!work.name.trim() || work.date > today() || !['construction', 'repair', 'improvement', 'decoration', 'built_in', 'equipment'].includes(work.type) || !['capital', 'expense'].includes(work.treatment)) fail('รายละเอียดงานบ้านไม่ถูกต้อง')
        if (!Array.isArray(work.roomNames) || new Set(work.roomNames).size !== work.roomNames.length || work.roomNames.some(room => !home.rooms.includes(room))) fail('เลือกห้องที่เกี่ยวข้องกับงานให้ถูกต้อง')
      }
    }
    const replacements = home.boq.filter(b => !b.cancelled && b.replacesId).map(b => b.replacesId)
    if (new Set(replacements).size !== replacements.length) fail('รายการ BOQ เดิมถูกแทนซ้ำ')
    if (home.valuations !== undefined) {
      if (!Array.isArray(home.valuations) || home.valuations.length > 10000) fail('ประวัติราคาประเมินไม่ถูกต้อง')
      for (const v of home.valuations) { id(v.id); date(v.date); amount(v.landValue); amount(v.buildingValue); text(v.source); text(v.notes); if (!v.source.trim() || v.date > today()) fail('กรุณาระบุที่มาของราคาประเมิน และวันที่ต้องไม่เป็นอนาคต'); if (home.kind !== 'house' && v.landValue) fail('ราคาประเมินที่ดินใช้เฉพาะอสังหาริมทรัพย์') }
    }
  }
  if (data.properties !== undefined && (!Array.isArray(data.properties) || data.properties.length > 100)) fail('รายการ PROPERTY ไม่ถูกต้อง')
  const propertyCodes = new Set<string>(), linkedAssets = new Set<string>()
  for (const property of data.properties ?? []) {
    const keys = ['id', 'code', 'name', 'landId', 'buildingId', 'assetIds', 'type', 'status', 'latitude', 'longitude', ...Object.keys(propertyAddressFields)]
    if (!property || Object.keys(property).some(key => !keys.includes(key))) fail('PROPERTY เก็บเฉพาะความสัมพันธ์ ไม่บันทึกต้นทุนซ้ำ')
    id(property.id); text(property.code); text(property.name)
    if (!/^(?:PROP|PROPERTY)-[0-9]{3,}$/.test(property.code) || propertyCodes.has(property.code)) fail('รหัส PROPERTY ซ้ำหรือไม่ถูกต้อง')
    propertyCodes.add(property.code)
    if (!property.name.trim()) fail('กรุณาระบุชื่อ PROPERTY')
    if (property.type !== undefined && !Object.hasOwn(propertyTypes, property.type)) fail('ประเภท PROPERTY ไม่ถูกต้อง')
    if (property.status !== undefined && !Object.hasOwn(propertyStatuses, property.status)) fail('สถานะ PROPERTY ไม่ถูกต้อง')
    for (const key of Object.keys(propertyAddressFields) as (keyof typeof propertyAddressFields)[]) if (property[key] !== undefined) text(property[key])
    if (property.postalCode && !/^\d{5}$/.test(property.postalCode)) fail('รหัสไปรษณีย์ต้องมี 5 หลัก')
    for (const [value, limit] of [[property.latitude, 90], [property.longitude, 180]] as const) if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit)) fail('พิกัด PROPERTY ไม่ถูกต้อง')
    if (property.assetIds !== undefined && (!Array.isArray(property.assetIds) || property.assetIds.length > 100)) fail('รายการสินทรัพย์ใน PROPERTY ไม่ถูกต้อง')
    if (property.assetIds !== undefined && (property.landId !== undefined || property.buildingId !== undefined)) fail('กรุณาใช้รูปแบบความสัมพันธ์ PROPERTY เพียงรูปแบบเดียว')
    const members = propertyAssetIds(property)
    if (!members.length || new Set(members).size !== members.length) fail('เลือกสินทรัพย์อย่างน้อย 1 รายการ และห้ามเลือกซ้ำ')
    for (const assetId of members) {
      text(assetId)
      const asset = data.homes.find(home => home.id === assetId)
      if (!asset || asset.kind !== 'house' || asset.archivedOn) fail('กรุณาเลือกสินทรัพย์อสังหาริมทรัพย์ที่ยังใช้งานอยู่')
      if (linkedAssets.has(assetId)) fail('สินทรัพย์นี้เชื่อมกับ PROPERTY อื่นแล้ว')
      linkedAssets.add(assetId)
    }
  }
  if (!Array.isArray(data.loans) || data.loans.length > 1000) fail('รายการเงินกู้ไม่ถูกต้อง')
  for (const home of data.loans) {
    id(home.id); text(home.bank); text(home.name); text(home.accountNumber)
    if (!home.bank.trim() || !home.name.trim()) fail('กรุณาระบุธนาคารและชื่อเงินกู้')
    if (home.assetId !== null && !data.homes.some(asset => asset.id === home.assetId)) fail('ไม่พบสินทรัพย์ที่เชื่อมกับเงินกู้')
    if (!Array.isArray(home.rounds) || !Array.isArray(home.payments) || home.rounds.length > 1000 || home.payments.length > 10000) fail('รายการสัญญาหรือชำระไม่ถูกต้อง')
    for (let index = 0; index < home.rounds.length; index++) {
      const r = home.rounds[index]; id(r.id); text(r.name); text(r.notes); date(r.effectiveOn, index === 0)
      if (!r.name.trim()) fail('กรุณาระบุชื่อรอบสัญญา')
      amount(r.opening, true); amount(r.mrr); amount(r.fee); amount(r.referenceInterest)
      if (r.mrr > 100 || !Number.isInteger(r.months) || r.months < 1 || r.months > 600 || !Array.isArray(r.periods) || !r.periods.length || r.periods.length > 600) fail('ระยะเวลาหรือดอกเบี้ยไม่ถูกต้อง')
      let next = 1
      for (const p of r.periods) {
        if (!Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from !== next || p.to < p.from || p.to > r.months) fail('ช่วงดอกเบี้ยต้องต่อเนื่อง เริ่มเดือน 1 และไม่ซ้อนกัน')
        amount(p.rate); amount(p.discount); amount(p.installment, true)
        if (p.rate > 100 || p.discount > 100 || typeof p.floating !== 'boolean') fail('อัตราดอกเบี้ยไม่ถูกต้อง')
        next = p.to + 1
      }
      if (next !== r.months + 1) fail('ช่วงดอกเบี้ยต้องครอบคลุมระยะเวลาคงเหลือทั้งหมด')
      if (index > 0) {
        const previous = home.rounds[index - 1]
        if (!previous.effectiveOn || r.effectiveOn <= previous.effectiveOn) fail('วันที่รีเทนชันต้องหลังรอบเดิม')
        if (Math.abs(r.opening - balance(home, previous)) > .01) fail('ยอดยกมารีเทนชันต้องตรงกับเงินต้นคงเหลือรอบก่อน')
      }
    }
    const duplicates = new Set<string>()
    for (const p of home.payments) {
      id(p.id); text(p.reference); date(p.date); amount(p.amount, true); amount(p.interest); amount(p.principal)
      if (Math.abs(roundMoney(p.amount - p.interest) - p.principal) > .01) fail('ยอดชำระต้องเท่ากับเงินต้นบวกดอกเบี้ย')
      if (p.date > today()) fail('รายการชำระจริงต้องไม่เป็นวันที่ในอนาคต')
      if (p.ledgerEntryId !== undefined && (!Number.isSafeInteger(p.ledgerEntryId) || p.ledgerEntryId < 1)) fail('เลขรายการบัญชีไม่ถูกต้อง')
      const ri = home.rounds.findIndex(r => r.id === p.roundId); const r = home.rounds[ri]; const nextRound = home.rounds[ri + 1]
      if (!r || !r.effectiveOn || p.date < r.effectiveOn || nextRound && p.date >= nextRound.effectiveOn) fail('วันชำระต้องอยู่ในช่วงรอบสัญญาที่เลือก')
      const key = `${p.roundId}|${p.date}|${p.amount}|${p.interest}|${p.reference}`
      if (duplicates.has(key)) fail('พบรายการชำระซ้ำ'); duplicates.add(key)
    }
    for (const r of home.rounds) if (balance(home, r) < 0) fail('ยอดตัดเงินต้นเกินหนี้คงเหลือ')
  }
}
