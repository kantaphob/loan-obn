import { roundMoney, type Home } from '../_shared/model'

/** Receipt comparisons never write BOQ, payments or change-order amounts. */
export function equipmentBoqReport(home: Home) {
  return home.boq.filter(boq => home.items.some(item => item.boqId === boq.id)).map(boq => {
    const items = home.items.filter(item => item.boqId === boq.id)
    const received = items.filter(item => item.purchaseStatus !== 'planned' && item.receivedOn)
    const reference = roundMoney(items.reduce((sum,item) => sum + (item.referencePrice ?? 0) * item.quantity, 0))
    const receivedValue = roundMoney(received.reduce((sum,item) => sum + item.price * item.quantity, 0))
    const materialBudget = roundMoney(boq.quantity * boq.price)
    return { id: boq.id, name: boq.name, cancelled: Boolean(boq.cancelled), materialBudget, labor: boq.labor, reference, receivedValue, receivedCount: received.length, pendingCount: items.length - received.length, difference: received.length ? roundMoney(receivedValue - materialBudget) : null }
  })
}
