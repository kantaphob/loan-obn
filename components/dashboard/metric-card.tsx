import { Card } from '@/components/ui/card'
import { Icon, type IconName } from './icon'

type MetricCardProps = {
  label: string
  value: string
  change: string
  note: string
  icon: IconName
  tone?: 'emerald' | 'amber' | 'green'
}

export function MetricCard({ label, value, change, note, icon, tone = 'emerald' }: MetricCardProps) {
  return (
    <Card as="article" className={`metric-card metric-${tone} forecast-metric`}>
      <div className="forecast-metric-heading">
        <span className="forecast-icon"><Icon name={icon} /></span>
        <span>{label}</span>
      </div>
      <strong className="forecast-value">{value}</strong>
      <p className="forecast-change"><span>{change}</span><span>{note}</span></p>
    </Card>
  )
}
