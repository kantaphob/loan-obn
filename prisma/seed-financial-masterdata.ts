import { getDatabaseUrl } from '../lib/database-config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrl(),
})
const prisma = new PrismaClient({ adapter })

const financialCategories = [
  { code: 'OPENING_CAPITAL', nameTh: 'เงินทุนเริ่มต้น', nameEn: 'Opening capital', group: 'CAPITAL', direction: 'IN', sortOrder: 10 },
  { code: 'CAPITAL_INCREASE', nameTh: 'เงินทุนเพิ่ม', nameEn: 'Additional capital', group: 'CAPITAL', direction: 'IN', sortOrder: 20 },
  { code: 'CAPITAL_WITHDRAWAL', nameTh: 'ถอนทุน', nameEn: 'Capital withdrawal', group: 'CAPITAL', direction: 'OUT', sortOrder: 30 },
  { code: 'LOAN_DISBURSEMENT', nameTh: 'ปล่อยกู้', nameEn: 'Loan disbursement', group: 'LOAN', direction: 'OUT', sortOrder: 40 },
  { code: 'CONTRACT_REPAYMENT', nameTh: 'รับชำระคืนตามสัญญา', nameEn: 'Contract repayment', group: 'LOAN', direction: 'IN', sortOrder: 45 },
  { code: 'PRINCIPAL_REPAYMENT', nameTh: 'รับชำระเงินต้น', nameEn: 'Principal repayment', group: 'LOAN', direction: 'IN', sortOrder: 50 },
  { code: 'INTEREST_RECEIVED', nameTh: 'รับดอกเบี้ย', nameEn: 'Interest received', group: 'INCOME', direction: 'IN', sortOrder: 60 },
  { code: 'FEE_RECEIVED', nameTh: 'รับค่าธรรมเนียม', nameEn: 'Fee received', group: 'INCOME', direction: 'IN', sortOrder: 70 },
  { code: 'LATE_FEE_RECEIVED', nameTh: 'รับค่าปรับล่าช้า', nameEn: 'Late fee received', group: 'INCOME', direction: 'IN', sortOrder: 80 },
  { code: 'OPERATING_EXPENSE', nameTh: 'ค่าใช้จ่ายดำเนินงาน', nameEn: 'Operating expense', group: 'EXPENSE', direction: 'OUT', sortOrder: 90 },
  { code: 'BORROWED_CAPITAL_RECEIVED', nameTh: 'รับเงินทุนจากผู้ให้ทุน', nameEn: 'Funding received', group: 'CAPITAL', direction: 'IN', sortOrder: 100 },
  { code: 'BORROWED_CAPITAL_REPAID', nameTh: 'คืนเงินต้นผู้ให้ทุน', nameEn: 'Funding principal repaid', group: 'CAPITAL', direction: 'OUT', sortOrder: 110 },
  { code: 'ADDITIONAL_DISBURSEMENT', nameTh: 'จ่ายเงินกู้เพิ่มเติม', nameEn: 'Additional loan disbursement', group: 'LOAN', direction: 'OUT', sortOrder: 120 },
  { code: 'EARLY_PRINCIPAL_REPAYMENT', nameTh: 'รับชำระเงินต้นก่อนกำหนด', nameEn: 'Early principal repayment', group: 'LOAN', direction: 'IN', sortOrder: 130 },
  { code: 'CLOSING_PRINCIPAL_REPAYMENT', nameTh: 'รับเงินต้นปิดสัญญา', nameEn: 'Closing principal repayment', group: 'LOAN', direction: 'IN', sortOrder: 140 },
  { code: 'DISBURSEMENT_RETURNED', nameTh: 'รับคืนเงินปล่อยกู้ที่ยกเลิก', nameEn: 'Cancelled disbursement returned', group: 'LOAN', direction: 'IN', sortOrder: 150 },
  { code: 'PRINCIPAL_OVERPAYMENT_REFUND', nameTh: 'คืนเงินต้นที่รับเกิน', nameEn: 'Principal overpayment refund', group: 'LOAN', direction: 'OUT', sortOrder: 160 },
  { code: 'COLLECTION_FEE_RECEIVED', nameTh: 'รับค่าติดตามชำระ', nameEn: 'Collection fee received', group: 'INCOME', direction: 'IN', sortOrder: 170 },
  { code: 'CONTRACT_FEE_RECEIVED', nameTh: 'รับค่าดำเนินการสัญญา', nameEn: 'Contract fee received', group: 'INCOME', direction: 'IN', sortOrder: 180 },
  { code: 'INTEREST_REFUND', nameTh: 'คืนดอกเบี้ยที่รับเกิน', nameEn: 'Interest refund', group: 'EXPENSE', direction: 'OUT', sortOrder: 190 },
  { code: 'FEE_REFUND', nameTh: 'คืนค่าธรรมเนียม', nameEn: 'Fee refund', group: 'EXPENSE', direction: 'OUT', sortOrder: 200 },
  { code: 'LATE_FEE_REFUND', nameTh: 'คืนค่าปรับล่าช้า', nameEn: 'Late fee refund', group: 'EXPENSE', direction: 'OUT', sortOrder: 210 },
  { code: 'FUNDING_INTEREST_PAID', nameTh: 'จ่ายดอกเบี้ยผู้ให้ทุน', nameEn: 'Funding interest paid', group: 'EXPENSE', direction: 'OUT', sortOrder: 220 },
  { code: 'PROFIT_DISTRIBUTION', nameTh: 'จ่ายส่วนแบ่งกำไรผู้ให้ทุน', nameEn: 'Funding profit distribution', group: 'CAPITAL', direction: 'OUT', sortOrder: 230 },
  { code: 'BANK_TRANSFER_FEE', nameTh: 'ค่าธรรมเนียมโอนเงิน', nameEn: 'Bank transfer fee', group: 'EXPENSE', direction: 'OUT', sortOrder: 240 },
  { code: 'COLLECTION_EXPENSE', nameTh: 'ค่าใช้จ่ายติดตามชำระ', nameEn: 'Collection expense', group: 'EXPENSE', direction: 'OUT', sortOrder: 250 },
  { code: 'LEGAL_EXPENSE', nameTh: 'ค่าใช้จ่ายทางกฎหมาย', nameEn: 'Legal expense', group: 'EXPENSE', direction: 'OUT', sortOrder: 260 },
  { code: 'CONTRACT_EXPENSE', nameTh: 'ค่าเอกสารและจัดทำสัญญา', nameEn: 'Contract preparation expense', group: 'EXPENSE', direction: 'OUT', sortOrder: 270 },
  { code: 'CREDIT_CHECK_EXPENSE', nameTh: 'ค่าตรวจสอบข้อมูลผู้กู้', nameEn: 'Borrower verification expense', group: 'EXPENSE', direction: 'OUT', sortOrder: 280 },
  { code: 'COLLATERAL_APPRAISAL_EXPENSE', nameTh: 'ค่าประเมินหลักประกัน', nameEn: 'Collateral appraisal expense', group: 'EXPENSE', direction: 'OUT', sortOrder: 290 },
  { code: 'COLLATERAL_REGISTRATION_EXPENSE', nameTh: 'ค่าจดทะเบียนหลักประกัน', nameEn: 'Collateral registration expense', group: 'EXPENSE', direction: 'OUT', sortOrder: 300 },
  { code: 'TAX_PAID', nameTh: 'จ่ายภาษีและอากร', nameEn: 'Tax and stamp duty paid', group: 'EXPENSE', direction: 'OUT', sortOrder: 310 },
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
  { code: 'PROMPTPAY', nameTh: 'พร้อมเพย์', nameEn: 'PromptPay' },
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

const interestRates = [0, 5, 10, 15, 20].map((percent, index) => ({
  code: `RATE_${percent}`, percent, sortOrder: (index + 1) * 10,
}))

const loanStatuses = [
  { code: 'AWAITING_FUNDS', nameTh: 'รอรับยอด', sortOrder: 10 },
  { code: 'AWAITING_REPAYMENT', nameTh: 'รอส่งคืน', sortOrder: 20 },
  { code: 'OVERDUE', nameTh: 'เกินกำหนดชำระ', sortOrder: 30 },
  { code: 'RETURNED', nameTh: 'ส่งคืน', sortOrder: 40 },
  { code: 'CLOSED', nameTh: 'ปิดยอด', sortOrder: 50 },
  { code: 'UNDER_REVIEW', nameTh: 'พิจารณา', sortOrder: 60 },
  { code: 'CONTRACT_RESERVED', nameTh: 'จองสัญญา', sortOrder: 70 },
]

async function main() {
  for (const category of financialCategories) {
    await prisma.financialCategory.upsert({ where: { code: category.code }, create: category, update: {} })
  }
  for (const rating of riskRatings) {
    await prisma.riskRating.upsert({ where: { code: rating.code }, create: rating, update: {} })
  }
  for (const channel of paymentChannels) {
    await prisma.paymentChannel.upsert({ where: { code: channel.code }, create: channel, update: {} })
  }
  for (const bank of banks) {
    await prisma.bank.upsert({ where: { code: bank.code }, create: bank, update: {} })
  }

  for (const rate of interestRates) {
    await prisma.interestRate.upsert({ where: { code: rate.code }, create: rate, update: {} })
  }
  for (const status of loanStatuses) {
    await prisma.loanStatus.upsert({ where: { code: status.code }, create: status, update: {} })
  }

  console.log(`Seeded ${financialCategories.length} transaction categories, ${riskRatings.length} risk ratings, ${paymentChannels.length} payment channels, and ${banks.length} banks, ${interestRates.length} interest rates, and ${loanStatuses.length} loan statuses.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
