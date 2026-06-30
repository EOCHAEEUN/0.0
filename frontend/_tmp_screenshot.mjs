import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setViewportSize({ width: 1440, height: 900 })

// 기본 상태 (필수값 검증 에러 포함) - 제출 버튼 클릭 시뮬레이션
await page.goto('http://localhost:5175/analysis/new', { waitUntil: 'networkidle' })
await page.click('.ff-primary-action')
await page.waitForTimeout(300)
await page.screenshot({ path: 'screenshots/04-analysis-validation.png', fullPage: false })

// 선택 정보 펼침
await page.goto('http://localhost:5175/analysis/new', { waitUntil: 'networkidle' })
await page.click('.ff-analysis-optional > summary')
await page.waitForTimeout(300)
await page.screenshot({ path: 'screenshots/05-analysis-expanded.png', fullPage: true })

// CNC 선택 시 placeholder 확인
await page.goto('http://localhost:5175/analysis/new', { waitUntil: 'networkidle' })
await page.selectOption('select', 'cnc')
await page.waitForTimeout(200)
await page.screenshot({ path: 'screenshots/06-analysis-cnc.png', fullPage: false })

await browser.close()
