import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./ProgressSQL.db',
})
const prisma = new PrismaClient({ adapter })

const financialCategories = [
  { code: 'OPENING_CAPITAL', nameTh: 'เงินทุนเริ่มต้น', nameEn: 'Opening capital', group: 'CAPITAL', direction: 'IN', sortOrder: 10 },
  { code: 'CAPITAL_INCREASE', nameTh: 'เงินทุนเพิ่ม', nameEn: 'Additional capital', group: 'CAPITAL', direction: 'IN', sortOrder: 20 },
  { code: 'CAPITAL_WITHDRAWAL', nameTh: 'ถอนทุน', nameEn: 'Capital withdrawal', group: 'CAPITAL', direction: 'OUT', sortOrder: 30 },
  { code: 'LOAN_DISBURSEMENT', nameTh: 'ปล่อยกู้', nameEn: 'Loan disbursement', group: 'LOAN', direction: 'OUT', sortOrder: 40 },
  { code: 'PRINCIPAL_REPAYMENT', nameTh: 'รับชำระเงินต้น', nameEn: 'Principal repayment', group: 'LOAN', direction: 'IN', sortOrder: 50 },
  { code: 'INTEREST_RECEIVED', nameTh: 'รับดอกเบี้ย', nameEn: 'Interest received', group: 'INCOME', direction: 'IN', sortOrder: 60 },
  { code: 'FEE_RECEIVED', nameTh: 'รับค่าธรรมเนียม', nameEn: 'Fee received', group: 'INCOME', direction: 'IN', sortOrder: 70 },
  { code: 'LATE_FEE_RECEIVED', nameTh: 'รับค่าปรับล่าช้า', nameEn: 'Late fee received', group: 'INCOME', direction: 'IN', sortOrder: 80 },
  { code: 'OPERATING_EXPENSE', nameTh: 'ค่าใช้จ่ายดำเนินงาน', nameEn: 'Operating expense', group: 'EXPENSE', direction: 'OUT', sortOrder: 90 },
] as const

const riskRatings = [
  { code: 'SS', nameTh: 'SS', score: 1, isBlacklist: false },
  { code: 'S', nameTh: 'S', score: 2, isBlacklist: false },
  { code: 'A', nameTh: 'A', score: 3, isBlacklist: false },
  { code: 'B', nameTh: 'B', score: 4, isBlacklist: false },
  { code: 'C', nameTh: 'C', score: 5, isBlacklist: false },
  { code: 'D', nameTh: 'D', score: 6, isBlacklist: false },
  { code: 'BLACKLIST', nameTh: 'Blacklist', score: 99, isBlacklist: true },
] as const

const paymentChannels = [
  { code: 'BANKING', nameTh: 'ธนาคาร', nameEn: 'Bank transfer' },
  { code: 'CASH', nameTh: 'เงินสด', nameEn: 'Cash' },
] as const

const banks = [
  { code: 'BBL', nameTh: 'ธนาคารกรุงเทพ', nameEn: 'Bangkok Bank', shortName: 'BBL', sortOrder: 10 },
  { code: 'KBANK', nameTh: 'ธนาคารกสิกรไทย', nameEn: 'Kasikornbank', shortName: 'กสิกรไทย', sortOrder: 20 },
  { code: 'KTB', nameTh: 'ธนาคารกรุงไทย', nameEn: 'Krung Thai Bank', shortName: 'กรุงไทย', sortOrder: 30 },
  { code: 'SCB', nameTh: 'ธนาคารไทยพาณิชย์', nameEn: 'Siam Commercial Bank', shortName: 'ไทยพาณิชย์', sortOrder: 40 },
  { code: 'BAY', nameTh: 'ธนาคารกรุงศรีอยุธยา', nameEn: 'Bank of Ayudhya', shortName: 'กรุงศรี', sortOrder: 50 },
  { code: 'TTB', nameTh: 'ธนาคารทหารไทยธนชาต', nameEn: 'TMBThanachart Bank', shortName: 'ทีทีบี', sortOrder: 60 },
  { code: 'GSB', nameTh: 'ธนาคารออมสิน', nameEn: 'Government Savings Bank', shortName: 'ออมสิน', sortOrder: 70 },
  { code: 'BAAC', nameTh: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', nameEn: 'Bank for Agriculture and Agricultural Cooperatives', shortName: 'ธ.ก.ส.', sortOrder: 80 },
  { code: 'GHB', nameTh: 'ธนาคารอาคารสงเคราะห์', nameEn: 'Government Housing Bank', shortName: 'ธอส.', sortOrder: 90 },
  { code: 'IBANK', nameTh: 'ธนาคารอิสลามแห่งประเทศไทย', nameEn: 'Islamic Bank of Thailand', shortName: 'ไอแบงก์', sortOrder: 100 },
  { code: 'EXIM', nameTh: 'ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย', nameEn: 'Export-Import Bank of Thailand', shortName: 'EXIM BANK', sortOrder: 110 },
  { code: 'SME', nameTh: 'ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย', nameEn: 'SME Development Bank of Thailand', shortName: 'SME D Bank', sortOrder: 120 },
  { code: 'KKP', nameTh: 'ธนาคารเกียรตินาคินภัทร', nameEn: 'Kiatnakin Phatra Bank', shortName: 'เกียรตินาคินภัทร', sortOrder: 130 },
  { code: 'TISCO', nameTh: 'ธนาคารทิสโก้', nameEn: 'TISCO Bank', shortName: 'ทิสโก้', sortOrder: 140 },
  { code: 'CIMBT', nameTh: 'ธนาคารซีไอเอ็มบี ไทย', nameEn: 'CIMB Thai Bank', shortName: 'CIMB THAI', sortOrder: 150 },
  { code: 'UOBT', nameTh: 'ธนาคารยูโอบี', nameEn: 'United Overseas Bank (Thai)', shortName: 'UOB', sortOrder: 160 },
  { code: 'LH', nameTh: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', nameEn: 'Land and Houses Bank', shortName: 'LH Bank', sortOrder: 170 },
  { code: 'ICBCT', nameTh: 'ธนาคารไอซีบีซี (ไทย)', nameEn: 'ICBC (Thai) Bank', shortName: 'ICBC Thai', sortOrder: 180 },
  { code: 'TCRB', nameTh: 'ธนาคารไทยเครดิต', nameEn: 'Thai Credit Bank', shortName: 'ไทยเครดิต', sortOrder: 190 },
] as const

async function main() {
  for (const category of financialCategories) {
    await prisma.financialCategory.upsert({ where: { code: category.code }, create: category, update: category })
  }
  for (const rating of riskRatings) {
    await prisma.riskRating.upsert({ where: { code: rating.code }, create: rating, update: rating })
  }
  for (const channel of paymentChannels) {
    await prisma.paymentChannel.upsert({ where: { code: channel.code }, create: channel, update: channel })
  }
  for (const bank of banks) {
    await prisma.bank.upsert({ where: { code: bank.code }, create: bank, update: bank })
  }

  console.log(`Seeded ${financialCategories.length} transaction categories, ${riskRatings.length} risk ratings, ${paymentChannels.length} payment channels, and ${banks.length} banks.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
