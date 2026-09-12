import { expect, test } from 'vitest'
import { marketLabel, marketTime } from '../src/client/market-labels.js'

test('withdrawn claims and synthetic data remain explicit in all supported locales', () => {
  expect(marketLabel('lifecycle', 'retracted', 'zh')).toBe('已撤回')
  expect(marketLabel('origin', 'fixture', 'en')).toBe('Test sample')
  expect(marketLabel('claim', 'correction', 'pseudo')).toContain('Correction Correction')
})

test('display times follow the declared timezone rather than the browser timezone', () => {
  expect(marketTime('2026-09-10T23:30:00Z', 'Asia/Shanghai', 'zh')).toContain('2026/09/11')
  expect(marketTime('2026-09-10T23:30:00Z', 'Asia/Shanghai', 'zh')).toContain('07:30')
  expect(marketTime('2026-09-10T23:30:00Z', 'UTC', 'en')).toContain('23:30')
  expect(() => marketTime('invalid', 'UTC', 'en')).toThrow('market_time_invalid')
})
test('coverage gaps use human wording and unknown owner codes never imply health', () => {
  expect(marketLabel('reason', 'sampling_plan_not_preregistered', 'zh')).toContain('未登记')
  expect(marketLabel('health', 'freshness_unknown', 'zh')).toBe('时效未知')
  expect(marketLabel('health', 'unrecognized', 'en')).toBe('Not yet verified')
  expect(marketLabel('reason', '__proto__', 'zh')).toBe('尚待核验')
})
