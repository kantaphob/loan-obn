import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { referralEntitlementOnSettlement, referralPercentBasisPoints, referralShareFromPrincipal } from '../lib/referral-share'

describe('referral share arithmetic', () => {
  it('calculates 5% of principal independently from interest', () => {
    const principal = 1_000_000
    const interest = 200_000
    const share = referralShareFromPrincipal(principal, '5')
    assert.equal(share, 50_000)
    assert.equal(interest - share, 150_000)
    assert.equal(referralPercentBasisPoints('5.25'), 525)
  })

  it('does not accrue for partial receipt and creates the full fixed entitlement only on settlement', () => {
    assert.equal(referralEntitlementOnSettlement(25_000, false), 0)
    assert.equal(referralEntitlementOnSettlement(25_000, true), 25_000)
  })

  it('rejects malformed or out-of-range percents and unsafe amounts', () => {
    assert.throws(() => referralPercentBasisPoints('1.234'))
    assert.throws(() => referralPercentBasisPoints('101'))
    assert.throws(() => referralShareFromPrincipal(100.2, '5'))
  })
})
