import { balance, contractPrice, contractPaymentStages, priceContractStages, roundMoney, today, propertyAssetIds, propertyTypes, propertyStatuses, propertyAddressFields, type AssetData } from './model'

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
    if (home.saleDeclaration !== undefined) {
      const sale = home.saleDeclaration
      if (!sale || home.kind !== 'house' || Object.keys(sale).some(key => !['id','reportedOn','salePrice','bankPayoff','designRefund','mortgageRate','transferRate','stampRate'].includes(key))) fail('ข้อมูลแจ้งขายไม่ถูกต้อง')
      id(sale.id); date(sale.reportedOn); amount(sale.salePrice, true)
      if (sale.reportedOn > today()) fail('วันที่แจ้งขายต้องไม่เป็นอนาคต')
      for (const value of [sale.bankPayoff, sale.designRefund, sale.mortgageRate, sale.transferRate, sale.stampRate]) amount(value)
      if ([sale.mortgageRate, sale.transferRate, sale.stampRate].some(value => value > 100)) fail('อัตราค่าธรรมเนียมต้องไม่เกิน 100%')
    }
    if (home.disposedOn !== undefined) { date(home.disposedOn); if (home.sale ? home.disposedOn !== home.sale.date : !home.disposalSaleId || !data.homes.some(row => row.sale?.id === home.disposalSaleId && row.sale?.includedAssetIds.includes(home.id))) fail('สถานะขายสินทรัพย์ไม่สัมพันธ์กับใบขาย') }
    if (home.disposalSaleId !== undefined) text(home.disposalSaleId)
    if (home.sale !== undefined) {
      const sale = home.sale
      if (home.kind !== 'house' || home.disposedOn !== sale.date) fail('ใบขายต้องผูกกับบ้านที่ขายแล้ว')
      id(sale.id); date(sale.date); amount(sale.salePrice, true); amount(sale.sellingCosts); text(sale.buyer); text(sale.reference); text(sale.notes)
      if (sale.date > today() || !Array.isArray(sale.includedAssetIds) || !sale.includedAssetIds.includes(home.id) || new Set(sale.includedAssetIds).size !== sale.includedAssetIds.length || sale.includedAssetIds.some(assetId => !data.homes.some(row => row.id === assetId))) fail('รายการสินทรัพย์ในใบขายไม่ถูกต้อง')
      if (!Array.isArray(sale.payments) || sale.payments.length > 10000) fail('ประวัติรับเงินจากการขายไม่ถูกต้อง')
      let received = 0
      for (const payment of sale.payments) { id(payment.id); date(payment.date); amount(payment.amount, true); text(payment.reference); text(payment.note); if (!Number.isSafeInteger(payment.ledgerEntryId) || payment.ledgerEntryId < 1 || payment.date > today() || payment.date < sale.date) fail('รายการรับเงินขายบ้านไม่ถูกต้อง'); received += payment.amount }
      if (received > sale.salePrice + .009) fail('ยอดรับเงินจริงจากการขายเกินราคาขาย')
    }
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
      if (!item.name.trim() || item.room && !home.rooms.includes(item.room)) fail('กรุณาระบุชื่อสินค้าและเลือกห้องที่มีอยู่')
      amount(item.quantity, true); amount(item.price); date(item.purchasedOn, true); date(item.warrantyUntil, true)
      date(item.warrantyStart, true); amount(item.warrantyMonths)
      if (!Number.isInteger(item.warrantyMonths) || item.warrantyMonths > 1200) fail('ระยะประกันไม่ถูกต้อง')
      if (item.warrantyStart && item.warrantyUntil && item.warrantyUntil < item.warrantyStart) fail('วันสิ้นสุดประกันต้องไม่ก่อนวันเริ่มประกัน')
      if (item.purchasedOn && item.warrantyUntil && item.warrantyUntil < item.purchasedOn) fail('วันหมดประกันต้องไม่ก่อนวันซื้อ')
      if (item.serial !== undefined) text(item.serial)
      if (item.receipt !== undefined) {
        text(item.receipt.name)
        const dataUrl = item.receipt.dataUrl
        if (!item.receipt.name.trim() || item.receipt.name.length > 240 || !['application/pdf', 'image/jpeg', 'image/png'].includes(item.receipt.mimeType) || typeof dataUrl !== 'string' || dataUrl.length > 7_100_000 || !new RegExp(`^data:${item.receipt.mimeType};base64,[A-Za-z0-9+/]+={0,2}$`).test(dataUrl)) fail('ไฟล์ใบเสร็จหรือเอกสารแนบไม่ถูกต้อง หรือมีขนาดเกิน 5 MB')
      }
      if (item.status !== undefined && !['active', 'repair', 'removed', 'sold', 'retired'].includes(item.status)) fail('สถานะอุปกรณ์ไม่ถูกต้อง')
      if (item.includedInMainCost !== undefined && typeof item.includedInMainCost !== 'boolean') fail('การรวมราคาสินทรัพย์ไม่ถูกต้อง')
      if (item.boqId && !home.boq.some(b => b.id === item.boqId)) fail('ไม่พบรายการ BOQ ของอุปกรณ์')
      if (item.events !== undefined) {
        if (!Array.isArray(item.events) || item.events.length > 10000) fail('ประวัติอุปกรณ์ไม่ถูกต้อง')
        for (const event of item.events) { date(event.date); text(event.from); text(event.to); text(event.status) }
      }
    }
    for (const item of home.boq) {
      id(item.id); [item.category, item.subcategory ?? '', item.name, item.spec, item.unit, item.vendor, item.reference, item.note ?? ''].forEach(text)
      if (!item.name.trim()) fail('กรุณาระบุชื่อรายการ BOQ')
      amount(item.quantity, true); [item.price, item.labor, item.paid].forEach(n => amount(n))
      for (const amountValue of [item.materialTotal, item.laborRate, item.boqTotal]) if (amountValue !== undefined) amount(amountValue)
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
    if (home.boqManagementFee !== undefined) amount(home.boqManagementFee)
    if (home.boqAgreedTotal !== undefined) amount(home.boqAgreedTotal)
    if (home.boqVersion !== undefined && (!Number.isSafeInteger(home.boqVersion) || home.boqVersion < 1)) fail('เลขเวอร์ชัน BOQ ไม่ถูกต้อง')
    if (home.boqVersions !== undefined) {
      if (!Array.isArray(home.boqVersions) || home.boqVersions.length > 100) fail('ประวัติเวอร์ชัน BOQ ไม่ถูกต้อง')
      const versionIds = new Set<string>(); const versionNumbers = new Set<number>()
      for (const version of home.boqVersions) {
        text(version.id)
        if (!/^[a-zA-Z0-9-]{1,80}$/.test(version.id) || versionIds.has(version.id) || !Number.isSafeInteger(version.version) || version.version < 1 || versionNumbers.has(version.version)) fail('เวอร์ชัน BOQ ซ้ำหรือไม่ถูกต้อง')
        versionIds.add(version.id); versionNumbers.add(version.version); date(version.createdOn); amount(version.managementFee); if (version.agreedTotal !== undefined) amount(version.agreedTotal)
        if (!Array.isArray(version.items) || version.items.length > 10000) fail('รายการในเวอร์ชัน BOQ ไม่ถูกต้อง')
        const itemIds = new Set<string>()
        for (const item of version.items) {
          text(item.id)
          if (!/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || itemIds.has(item.id)) fail('รหัสรายการในเวอร์ชัน BOQ ซ้ำหรือไม่ถูกต้อง')
          itemIds.add(item.id); [item.category, item.subcategory ?? '', item.name, item.spec, item.unit, item.vendor, item.reference, item.note ?? ''].forEach(text)
          if (!item.name.trim()) fail('รายการในเวอร์ชัน BOQ ต้องมีชื่อ')
          amount(item.quantity, true); [item.price, item.labor, item.paid].forEach(n => amount(n))
          for (const amountValue of [item.materialTotal, item.laborRate, item.boqTotal]) if (amountValue !== undefined) amount(amountValue)
        }
      }
      if (home.boqVersions.some(version => version.version === (home.boqVersion ?? 1))) fail('เลขเวอร์ชัน BOQ ปัจจุบันซ้ำกับประวัติ')
    }
    if (home.buildingChangeOrders !== undefined) {
      if (home.kind !== 'house' || !Array.isArray(home.buildingChangeOrders) || home.buildingChangeOrders.length > 1000) fail('ใบงานเพิ่ม-ลดงานไม่ถูกต้อง')
      const orderIds = new Set<string>(); const orderNumbers = new Set<number>()
      for (const order of home.buildingChangeOrders) {
        id(order.id); text(order.title); text(order.reference); text(order.notes); date(order.date)
        if (orderIds.has(order.id) || !Number.isSafeInteger(order.number) || order.number < 1 || orderNumbers.has(order.number) || !Number.isSafeInteger(order.baseVersion) || order.baseVersion < 1 || !order.title.trim() || order.date > today() || !['draft', 'approved'].includes(order.status)) fail('รายละเอียดใบงานเพิ่ม-ลดงานไม่ถูกต้อง')
        orderIds.add(order.id); orderNumbers.add(order.number)
        if (!Array.isArray(order.lines) || order.lines.length < 1 || order.lines.length > 1000) fail('ใบงานต้องมีรายการอย่างน้อย 1 รายการ')
        const lineIds = new Set<string>()
        for (const line of order.lines) { id(line.id); text(line.description); amount(line.amount, true); if (lineIds.has(line.id) || !line.description.trim() || !['add', 'deduct'].includes(line.kind)) fail('รายการเพิ่ม-ลดงานไม่ถูกต้อง'); lineIds.add(line.id) }
        if (order.payments !== undefined) {
          if (!Array.isArray(order.payments) || order.payments.length > 10000) fail('ประวัติรับ–จ่ายใบงานไม่ถูกต้อง')
          let paidOut = 0; let refunded = 0
          for (const payment of order.payments) { id(payment.id); date(payment.date); amount(payment.amount, true); text(payment.reference); text(payment.note); if (!Number.isSafeInteger(payment.ledgerEntryId) || payment.ledgerEntryId < 1 || payment.date > today() || !['IN', 'OUT'].includes(payment.direction) || !['deposit', 'progress', 'final', 'refund'].includes(payment.type) || payment.direction === 'IN' && payment.type !== 'refund' || payment.direction === 'OUT' && payment.type === 'refund') fail('รายการรับ–จ่ายใบงานไม่ถูกต้อง'); if (payment.direction === 'OUT') paidOut += payment.amount; else refunded += payment.amount }
          if (refunded > paidOut) fail('ยอดรับคืนใบงานต้องไม่เกินยอดจ่าย')
        }
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
    if (home.buildingProjects !== undefined) {
      if (home.kind !== 'house' || !Array.isArray(home.buildingProjects) || home.buildingProjects.length > 10000) fail('รายการโครงการบ้านไม่ถูกต้อง')
      const projectIds = new Set<string>()
      for (const project of home.buildingProjects) {
        id(project.id); text(project.name); text(project.vendor); text(project.reference); text(project.notes); date(project.startedOn, true); date(project.completedOn, true); date(project.warrantyUntil, true); amount(project.lumpSum); amount(project.actualCost)
        if (projectIds.has(project.id) || !project.name.trim() || !['extension', 'renovation'].includes(project.type) || !['lump_sum', 'boq'].includes(project.pricingMode) || !['planned', 'in_progress', 'completed'].includes(project.status) || project.startedOn > today() || project.completedOn > today() || project.status === 'completed' && !project.completedOn) fail('รายละเอียดโครงการบ้านไม่ถูกต้อง')
        projectIds.add(project.id)
        if (!Array.isArray(project.roomNames) || new Set(project.roomNames).size !== project.roomNames.length || project.roomNames.some(room => !home.rooms.includes(room))) fail('เลือกห้องที่เกี่ยวข้องกับโครงการให้ถูกต้อง')
        if (!Array.isArray(project.boqLines) || project.boqLines.length > 10000 || project.pricingMode === 'boq' && !project.boqLines.length) fail('รายการ BOQ ของโครงการไม่ถูกต้อง')
        for (const line of project.boqLines) { id(line.id); text(line.name); text(line.unit); amount(line.quantity, true); amount(line.unitPrice); amount(line.labor); if (!line.name.trim() || !line.unit.trim()) fail('รายละเอียด BOQ โครงการไม่ครบ') }
        if (!Array.isArray(project.payments) || project.payments.length > 10000) fail('ประวัติรับ–จ่ายโครงการไม่ถูกต้อง')
        let paidOut = 0, refunded = 0
        for (const payment of project.payments) { id(payment.id); date(payment.date); amount(payment.amount, true); text(payment.reference); text(payment.note); if (!Number.isSafeInteger(payment.ledgerEntryId) || payment.ledgerEntryId < 1 || payment.date > today() || !['IN', 'OUT'].includes(payment.direction) || !['deposit', 'progress', 'final', 'refund'].includes(payment.type) || payment.direction === 'IN' && payment.type !== 'refund' || payment.direction === 'OUT' && payment.type === 'refund') fail('รายการรับ–จ่ายโครงการไม่ถูกต้อง'); if (payment.direction === 'OUT') paidOut += payment.amount; else refunded += payment.amount }
        if (refunded > paidOut) fail('ยอดรับคืนโครงการต้องไม่เกินยอดจ่าย')
        if (project.outcome !== undefined) {
          const outcome = project.outcome
          if (!['none', 'add_room', 'component', 'update_existing'].includes(outcome.type)) fail('ผลลัพธ์โครงการไม่ถูกต้อง')
          text(outcome.roomName); text(outcome.newRoomName); text(outcome.componentName); text(outcome.replacesItemId); amount(outcome.areaAddedSqm)
          if (outcome.type === 'add_room' && (!outcome.newRoomName.trim() || home.rooms.includes(outcome.newRoomName.trim()))) fail('ระบุชื่อห้องใหม่ที่ยังไม่มีในบ้าน')
          if (outcome.type === 'component' && !outcome.componentName.trim()) fail('ระบุชื่ออุปกรณ์หรือสิ่งติดตั้งที่ได้จากงาน')
          if (outcome.type === 'update_existing' && !home.items.some(item => item.id === outcome.replacesItemId)) fail('เลือกรายการเดิมที่ต้องการปรับปรุง')
        }
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
    if (home.contractorContracts !== undefined && (!Array.isArray(home.contractorContracts) || home.contractorContracts.length > 100)) fail('รายการสัญญาจ้างเหมาไม่ถูกต้อง')
    if (home.contractorPayments !== undefined && (!Array.isArray(home.contractorPayments) || home.contractorPayments.length > 10000)) fail('รายการจ่ายผู้รับเหมาไม่ถูกต้อง')
    const contractCodes = new Set<string>()
    const variationCodes = new Set<string>()
    for (const contract of home.contractorContracts ?? []) {
      id(contract.id); text(contract.code); text(contract.name); text(contract.contractor); text(contract.description); date(contract.signedOn, true); amount(contract.amount, true)
      if (contract.kind !== undefined && !['construction', 'land_purchase'].includes(contract.kind)) fail('ประเภทสัญญาจ่ายไม่ถูกต้อง')
      if (contract.landReference !== undefined) text(contract.landReference)
      if (contract.location !== undefined) text(contract.location)
      if (!contract.code.trim() || contractCodes.has(contract.code.trim().toUpperCase()) || !contract.name.trim() || !contract.contractor.trim() || !Array.isArray(contract.stages) || !contract.stages.length || contract.stages.length > 600) fail('ระบุรหัสสัญญา ชื่องาน ผู้รับเหมา และงวดงานให้ครบ รหัสสัญญาต้องไม่ซ้ำ')
      contractCodes.add(contract.code.trim().toUpperCase())
      const stageNumbers = new Set<number>(); let agreed = 0
      const percentSum = contract.stages.reduce((sum, stage) => sum + (stage.percent ?? 0), 0)
      if (contract.stages.every(stage => stage.percent !== undefined) && Math.abs(percentSum - 100) > .000001 || percentSum > 100.000001) fail('เปอร์เซ็นต์งวดชำระต้องรวมเป็น 100% และต้องไม่เกิน 100%')
      const pricedStages = priceContractStages(contract.amount, contract.stages)
      for (const stage of contract.stages) {
        id(stage.id); text(stage.name); date(stage.dueOn, true); amount(stage.amount, true)
        if (stage.percent !== undefined) {
          amount(stage.percent, true)
          if (stage.percent > 100 || Math.abs(stage.amount - pricedStages.find(row => row.id === stage.id)!.amount) > .009) fail('จำนวนเงินงวดชำระไม่ตรงกับเปอร์เซ็นต์ของราคาสัญญา')
        }
        if (!stage.name.trim() || !Number.isSafeInteger(stage.number) || stage.number < 1 || stageNumbers.has(stage.number) || stage.dueOn && contract.signedOn && stage.dueOn < contract.signedOn) fail('งวดงานต้องมีชื่อ เลขงวดไม่ซ้ำ และกำหนดจ่ายไม่ก่อนวันสัญญา')
        stageNumbers.add(stage.number); agreed = roundMoney(agreed + stage.amount)
      }
      if (agreed > contract.amount) fail('ยอดงวดงานรวมเกินมูลค่าสัญญาจ้างเหมา')
      if (contract.variations !== undefined && (!Array.isArray(contract.variations) || contract.variations.length > 1000 || contract.kind === 'land_purchase')) fail('รายการงานเพิ่ม–งานลดใช้กับสัญญาจ้างเหมาเท่านั้น')
      for (const variation of contract.variations ?? []) {
        id(variation.id); text(variation.code); text(variation.name); text(variation.unit); text(variation.reference); text(variation.notes); date(variation.date)
        amount(variation.quantity, true); amount(variation.unitPrice, true); amount(variation.amount, true)
        if (!variation.code.trim() || variationCodes.has(variation.code.toUpperCase()) || !variation.name.trim() || !variation.unit.trim() || !['add', 'deduct'].includes(variation.kind) || !['draft', 'approved', 'cancelled'].includes(variation.status) || Math.abs(roundMoney(variation.quantity * variation.unitPrice) - variation.amount) > .009) fail('ข้อมูลหรือราคางานเพิ่ม–งานลดไม่ถูกต้อง รหัสต้องไม่ซ้ำ')
        variationCodes.add(variation.code.toUpperCase())
        if (variation.stageId !== undefined && !contract.stages.some(stage => stage.id === variation.stageId) || variation.kind === 'deduct' && !variation.stageId) fail('กรุณาเลือกงวดงานเดิมที่ปรับลดหรือปรับเพิ่ม')
        if (variation.status === 'approved' && (variation.date > today() || contract.signedOn && variation.date < contract.signedOn)) fail('วันที่ตกลงงานเพิ่ม–งานลดต้องไม่ก่อนสัญญาหรือเป็นอนาคต')
      }
      if (contractPrice(contract).net < 0 || contractPaymentStages(contract).some(stage => stage.amount < 0)) fail('ลดงานเกินราคาสัญญาหรือยอดงวดงาน')
      amount(contractPrice(contract).net)
    }
    for (const payment of home.contractorPayments ?? []) {
      id(payment.id); date(payment.date); amount(payment.amount, true); text(payment.reference); text(payment.notes)
      const contract = home.contractorContracts?.find(row => row.id === payment.contractId)
      const stage = contract && contractPaymentStages(contract, payment.date).find(row => row.id === payment.stageId)
      if (!contract || !stage || payment.date > today() || contract.signedOn && payment.date < contract.signedOn || !Number.isSafeInteger(payment.ledgerEntryId) || payment.ledgerEntryId < 1) fail('สัญญา งวดงาน หรือวันที่จ่ายผู้รับเหมาไม่ถูกต้อง')
    }
    for (const contract of home.contractorContracts ?? []) {
      const payments = (home.contractorPayments ?? []).filter(p => p.contractId === contract.id)
      if (roundMoney(payments.reduce((sum, p) => sum + p.amount, 0)) > contractPrice(contract).net) fail('จ่ายผู้รับเหมาเกินมูลค่าสัญญา')
      for (const stage of contractPaymentStages(contract)) if (roundMoney(payments.filter(p => p.stageId === stage.id).reduce((sum, p) => sum + p.amount, 0)) > stage.amount) fail('ยอดจ่ายเกินงวดงานที่ตกลง')
    }
    if (!home.bank.trim() || !home.name.trim()) fail('กรุณาระบุธนาคารและชื่อเงินกู้')
    if (home.assetId !== null && !data.homes.some(asset => asset.id === home.assetId)) fail('ไม่พบสินทรัพย์ที่เชื่อมกับเงินกู้')
    if (home.assetIds !== undefined) {
      if (!Array.isArray(home.assetIds) || home.assetIds.length > 100 || new Set(home.assetIds).size !== home.assetIds.length || home.assetId !== (home.assetIds[0] ?? null)) fail('รายการสินทรัพย์ที่เชื่อมกับเงินกู้ไม่ถูกต้องหรือซ้ำกัน')
      for (const assetId of home.assetIds) if (typeof assetId !== 'string' || !data.homes.some(asset => asset.id === assetId)) fail('ไม่พบสินทรัพย์ที่เชื่อมกับเงินกู้')
    }
    if (!Array.isArray(home.rounds) || !Array.isArray(home.payments) || home.rounds.length > 1000 || home.payments.length > 10000) fail('รายการสัญญาหรือชำระไม่ถูกต้อง')
    if (home.openingBalance !== undefined) { amount(home.openingBalance); if (!home.rounds[0] || home.openingBalance !== home.rounds[0].opening) fail('ยอดหนี้ตั้งต้นไม่ตรงกับสัญญาแรก') }
    for (let index = 0; index < home.rounds.length; index++) {
      const r = home.rounds[index]; id(r.id); text(r.name); text(r.notes); date(r.effectiveOn, index === 0)
      if (!r.name.trim()) fail('กรุณาระบุชื่อรอบสัญญา')
      amount(r.opening, r.creditLimit === undefined); amount(r.mrr); amount(r.fee); amount(r.referenceInterest)
      if (r.creditLimit !== undefined) { amount(r.creditLimit, true); if (r.opening > r.creditLimit) fail('ยอดหนี้ตั้งต้นต้องไม่เกินยอดกู้ทั้งหมด') }
      if (r.insurance !== undefined && !['qualifying', 'not_qualifying'].includes(r.insurance) || r.customerType !== undefined && !['welfare', 'retail', 'equipment'].includes(r.customerType)) fail('เงื่อนไขประกันหรือประเภทลูกค้าไม่ถูกต้อง')
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
      amount(p.fee ?? 0); amount(p.penalty ?? 0); amount(p.extraPrincipal ?? 0)
      if (p.notes !== undefined) text(p.notes)
      if (p.bankInstallment !== undefined) {
        amount(p.bankInstallment, true)
        const extra = Math.min(p.principal, Math.max(0, roundMoney(p.amount - (p.fee ?? 0) - (p.penalty ?? 0) - p.bankInstallment)))
        if (Math.abs(extra - (p.extraPrincipal ?? 0)) > .009) fail('ยอดโปะต้องตรงกับส่วนที่จ่ายเกินค่างวดธนาคาร')
      }
      if ((p.extraPrincipal ?? 0) > p.principal) fail('ยอดโปะต้องไม่เกินยอดตัดเงินต้นรวม')
      if (Math.abs(roundMoney(p.amount - p.interest - (p.fee ?? 0) - (p.penalty ?? 0)) - p.principal) > .01) fail('ยอดชำระต้องเท่ากับเงินต้นบวกดอกเบี้ยและค่าธรรมเนียม / ค่าปรับ')
      if (p.date > today()) fail('รายการชำระจริงต้องไม่เป็นวันที่ในอนาคต')
      if (p.ledgerEntryId !== undefined && (!Number.isSafeInteger(p.ledgerEntryId) || p.ledgerEntryId < 1)) fail('เลขรายการบัญชีไม่ถูกต้อง')
      const ri = home.rounds.findIndex(r => r.id === p.roundId); const r = home.rounds[ri]; const nextRound = home.rounds[ri + 1]
      if (!r || !r.effectiveOn || p.date < r.effectiveOn || nextRound && p.date >= nextRound.effectiveOn) fail('วันชำระต้องอยู่ในช่วงรอบสัญญาที่เลือก')
      const key = `${p.roundId}|${p.date}|${p.amount}|${p.interest}|${p.reference}`
      if (duplicates.has(key)) fail('พบรายการชำระซ้ำ'); duplicates.add(key)
    }
    if (home.disbursements !== undefined) {
      if (!Array.isArray(home.disbursements) || home.disbursements.length > 10000) fail('รายการเบิกเงินกู้ไม่ถูกต้อง')
      const first = home.rounds[0]; const retention = home.rounds[1]
      let drawn = 0
      const drawNumbers = new Set<string>()
      for (const row of home.disbursements) {
        id(row.id); date(row.date); amount(row.amount, true); text(row.reference); text(row.notes)
        if (row.drawType !== undefined && !['land', 'house'].includes(row.drawType)) fail('ประเภทรับเงินกู้ไม่ถูกต้อง')
        if (row.drawNumber !== undefined) {
          const drawKey = `${row.drawType ?? 'unspecified'}:${row.drawNumber}`
          if (!Number.isSafeInteger(row.drawNumber) || row.drawNumber < 1 || row.drawNumber > 10000 || drawNumbers.has(drawKey)) fail('เลขงวดรับต้องเป็นจำนวนเต็มบวกและไม่ซ้ำในประเภทเดียวกัน')
          drawNumbers.add(drawKey)
        }
        if (row.ledgerEntryId !== undefined && (!Number.isSafeInteger(row.ledgerEntryId) || row.ledgerEntryId < 1)) fail('เลขรายการบัญชีรับเงินกู้ไม่ถูกต้อง')
        if (!first || first.effectiveOn && row.date < first.effectiveOn || row.date > today() || retention && row.date >= retention.effectiveOn) fail('วันเบิกเงินต้องอยู่ในรอบสัญญาแรกและไม่เป็นอนาคต')
        drawn = roundMoney(drawn + row.amount)
      }
      if (roundMoney(drawn + (home.openingBalance ?? 0)) > (first?.creditLimit ?? first?.opening ?? 0)) fail('ยอดหนี้ตั้งต้นรวมยอดเบิกเกินวงเงินกู้')
      for (const payment of home.payments.filter(p => p.roundId === first?.id)) {
        const received = (home.openingBalance ?? 0) + home.disbursements.filter(row => row.date <= payment.date).reduce((sum, row) => sum + row.amount, 0)
        const paid = home.payments.filter(p => p.roundId === first.id && p.date <= payment.date).reduce((sum, p) => sum + p.principal, 0)
        if (roundMoney(paid) > roundMoney(received)) fail('ยอดตัดเงินต้นเกินยอดเบิก ณ วันชำระ')
      }
    }
    if (home.documents !== undefined) {
      if (!Array.isArray(home.documents) || home.documents.length > 100) fail('เอกสารเงินกู้มากเกินไป')
      for (const doc of home.documents) {
        id(doc.id); text(doc.name); text(doc.reference)
        if (!doc.name.trim() || !['contract', 'slip', 'other'].includes(doc.kind) || !doc.reference.trim() && !doc.file || doc.paymentId !== undefined && !home.payments.some(p => p.id === doc.paymentId)) fail('เอกสารหรือรายการชำระที่เชื่อมไม่ถูกต้อง')
        if (doc.file && (!['application/pdf', 'image/jpeg', 'image/png'].includes(doc.file.mimeType) || typeof doc.file.dataUrl !== 'string' || doc.file.dataUrl.length > 1_400_000 || !new RegExp(`^data:${doc.file.mimeType};base64,[A-Za-z0-9+/]+={0,2}$`).test(doc.file.dataUrl))) fail('รองรับ PDF / JPEG / PNG ขนาดไม่เกิน 1 MB')
      }
    }
    for (const r of home.rounds) if (balance(home, r) < 0) fail('ยอดตัดเงินต้นเกินหนี้คงเหลือ')
  }
}
