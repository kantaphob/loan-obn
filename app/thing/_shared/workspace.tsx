import { Wallet } from 'lucide-react'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'

type Props = { initialSection?: 'assets' | 'debts' | 'history'; initialTab?: string }

export function AssetWorkspace({ initialSection = 'assets', initialTab = 'overview' }: Props) {
  const titles: Record<string, string> = {
    overview: 'สินทรัพย์', boq: 'BOQ ก่อสร้าง', builtin: 'BOQ บิวท์อิน',
    items: 'ห้องและอุปกรณ์', valuation: 'มูลค่าประเมิน / Equity', payments: 'รายการชำระ / คงเหลือ',
  }
  const title = initialSection === 'history' ? 'ประวัติและกู้คืน'
    : initialSection === 'debts' ? initialTab === 'payments' ? titles.payments : 'เงินกู้ธนาคาร'
    : titles[initialTab] ?? titles.overview

  return <PageContainer><Header title={title} icon={<Wallet size={21} aria-hidden="true" />} /></PageContainer>
}
