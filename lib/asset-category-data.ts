export type AssetCategorySeed = { code: string; nameTh: string; nameEn: string; description: string; parentCode: string | null; sortOrder: number }

/** Parents precede their children so this catalog can be inserted without deferred constraints. */
export const ASSET_CATEGORY_DEFAULTS: AssetCategorySeed[] = [
  { code: 'CURRENT_ASSETS', nameTh: 'สินทรัพย์หมุนเวียน', nameEn: 'Current Assets', description: 'สินทรัพย์ที่คาดว่าจะเปลี่ยนเป็นเงินสด ใช้ไป หรือขายภายในรอบการดำเนินงานปกติ หรือภายใน 1 ปี', parentCode: null, sortOrder: 10 },
  { code: 'NON_CURRENT_ASSETS', nameTh: 'สินทรัพย์ไม่หมุนเวียน', nameEn: 'Non-Current Assets', description: 'สินทรัพย์ที่ถือไว้ใช้ประโยชน์ในระยะยาว และไม่ได้จัดเป็นสินทรัพย์หมุนเวียน', parentCode: null, sortOrder: 20 },
  { code: 'CASH_EQUIVALENTS', nameTh: 'เงินสดและรายการเทียบเท่าเงินสด', nameEn: 'Cash and Cash Equivalents', description: 'เช่น เงินสดในมือ เงินฝากธนาคาร และรายการเทียบเท่าเงินสด', parentCode: 'CURRENT_ASSETS', sortOrder: 10 },
  { code: 'TRADE_RECEIVABLES', nameTh: 'ลูกหนี้การค้า', nameEn: 'Trade Receivables', description: 'เงินที่ลูกค้าค้างชำระจากการซื้อสินค้าหรือบริการแบบเชื่อ', parentCode: 'CURRENT_ASSETS', sortOrder: 20 },
  { code: 'INVENTORIES', nameTh: 'สินค้าคงเหลือ', nameEn: 'Inventories', description: 'วัตถุดิบ งานระหว่างทำ และสินค้าสำเร็จรูปที่รอขาย', parentCode: 'CURRENT_ASSETS', sortOrder: 30 },
  { code: 'SHORT_TERM_INVESTMENTS', nameTh: 'เงินลงทุนชั่วคราว', nameEn: 'Short-Term Investments', description: 'เช่น กองทุนรวมตลาดเงิน และตราสารหนี้ระยะสั้น', parentCode: 'CURRENT_ASSETS', sortOrder: 40 },
  { code: 'PREPAID_EXPENSES', nameTh: 'ค่าใช้จ่ายจ่ายล่วงหน้า', nameEn: 'Prepaid Expenses', description: 'เช่น ค่าเช่าจ่ายล่วงหน้า และค่าประกันภัยจ่ายล่วงหน้า', parentCode: 'CURRENT_ASSETS', sortOrder: 50 },
  { code: 'TANGIBLE_ASSETS', nameTh: 'สินทรัพย์ที่มีตัวตน', nameEn: 'Tangible Assets', description: 'ทรัพย์สินที่มีลักษณะทางกายภาพและใช้ประโยชน์ระยะยาว', parentCode: 'NON_CURRENT_ASSETS', sortOrder: 10 },
  { code: 'INTANGIBLE_ASSETS', nameTh: 'สินทรัพย์ที่ไม่มีตัวตน', nameEn: 'Intangible Assets', description: 'สิทธิหรือทรัพยากรที่ไม่มีลักษณะทางกายภาพ', parentCode: 'NON_CURRENT_ASSETS', sortOrder: 20 },
  { code: 'LONG_TERM_INVESTMENTS', nameTh: 'เงินลงทุนระยะยาว', nameEn: 'Long-Term Investments', description: 'เช่น เงินลงทุนในบริษัทย่อย และการลงทุนที่ถือไว้ระยะยาว', parentCode: 'NON_CURRENT_ASSETS', sortOrder: 30 },
  { code: 'LAND', nameTh: 'ที่ดิน', nameEn: 'Land', description: 'ที่ดินที่กิจการถือไว้ใช้ประโยชน์', parentCode: 'TANGIBLE_ASSETS', sortOrder: 10 },
  { code: 'BUILDINGS', nameTh: 'อาคารและสิ่งปลูกสร้าง', nameEn: 'Buildings and Structures', description: 'เช่น อาคาร บ้าน และสิ่งปลูกสร้างที่ใช้ในกิจการ', parentCode: 'TANGIBLE_ASSETS', sortOrder: 20 },
  { code: 'MACHINERY_EQUIPMENT', nameTh: 'เครื่องจักรและอุปกรณ์', nameEn: 'Machinery and Equipment', description: 'เครื่องจักรและอุปกรณ์ที่ใช้ในการดำเนินงาน', parentCode: 'TANGIBLE_ASSETS', sortOrder: 30 },
  { code: 'VEHICLES', nameTh: 'ยานพาหนะ', nameEn: 'Vehicles', description: 'เช่น รถยนต์ รถบรรทุก และรถจักรยานยนต์', parentCode: 'TANGIBLE_ASSETS', sortOrder: 40 },
  { code: 'OFFICE_FURNITURE_EQUIPMENT', nameTh: 'เครื่องตกแต่งและอุปกรณ์สำนักงาน', nameEn: 'Office Furniture and Equipment', description: 'เช่น โต๊ะ เก้าอี้ เครื่องตกแต่ง และอุปกรณ์สำนักงาน', parentCode: 'TANGIBLE_ASSETS', sortOrder: 50 },
  { code: 'PATENTS_COPYRIGHTS', nameTh: 'สิทธิบัตรและลิขสิทธิ์', nameEn: 'Patents and Copyrights', description: 'สิทธิในสิ่งประดิษฐ์และผลงานที่กิจการถือครอง', parentCode: 'INTANGIBLE_ASSETS', sortOrder: 10 },
  { code: 'TRADEMARKS', nameTh: 'เครื่องหมายการค้า', nameEn: 'Trademarks', description: 'สิทธิในเครื่องหมายการค้าของกิจการ', parentCode: 'INTANGIBLE_ASSETS', sortOrder: 20 },
  { code: 'SOFTWARE', nameTh: 'โปรแกรมคอมพิวเตอร์ / ซอฟต์แวร์', nameEn: 'Computer Software', description: 'โปรแกรมคอมพิวเตอร์หรือสิทธิการใช้ซอฟต์แวร์ที่เข้าเกณฑ์สินทรัพย์', parentCode: 'INTANGIBLE_ASSETS', sortOrder: 30 },
  { code: 'GOODWILL', nameTh: 'ค่าความนิยม', nameEn: 'Goodwill', description: 'ค่าความนิยมที่เกิดจากการรวมธุรกิจและรับรู้ตามเกณฑ์บัญชี', parentCode: 'INTANGIBLE_ASSETS', sortOrder: 40 },
]
