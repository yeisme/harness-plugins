import {test,expect} from '@playwright/test'
for(const width of [360,560,960])for(const short of [false,true])test(`session tools ${width}px ${short?'short':'normal'} keeps calls and selected details reachable`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(`/session-tools?width=${width}&short=${short}`)
  const tools=page.locator('[data-mcp-inspector]'),list=tools.locator('.tools-activity-list')
  await expect(tools).toBeVisible()
  const rect=await list.boundingBox();expect(rect?.height).toBeGreaterThan(15)
  const firstRow = list.locator('.tools-activity-row').first()
  const rowBounds = await firstRow.boundingBox()
  expect(rowBounds).not.toBeNull()
  expect(rowBounds!.y).toBeGreaterThanOrEqual(rect!.y)
  expect(rowBounds!.y + rowBounds!.height).toBeLessThanOrEqual(rect!.y + rect!.height + 1)
  for (const selector of ['.tools-record-label', '.tools-record-status']) {
    const label = firstRow.locator(selector)
    await expect(label).toBeVisible()
    const bounds = await label.boundingBox()
    expect(bounds!.width).toBeGreaterThan(24)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(rect!.y + rect!.height + 1)
  }
  await list.locator('.tools-record-name').first().click()
  await expect(tools.locator('.tools-call-details')).toBeVisible()
  await tools.getByRole('button',{name:'Reveal original message'}).click()
  expect(await page.evaluate(()=>(window as unknown as {__revealed?:boolean}).__revealed)).toBe(true)
  await tools.getByRole('button',{name:'Back',exact:true}).click()
  await expect(list.locator('.tools-record-name').first()).toBeFocused()
  await expect(tools.locator('.tools-mobile-tabs button')).toHaveCount(2)
  await expect(tools).toHaveScreenshot(`session-tools-${width}-${short?'short':'normal'}.png`)
  if(short){await list.locator('.tools-record-name').first().click();await page.keyboard.press('Escape');await expect(list.locator('.tools-record-name').first()).toBeFocused();await expect(tools.locator('.tools-call-details')).toHaveCount(0)}
  expect(errors).toEqual([])
})

for (const width of [360, 560, 960]) test(`tools full-row selection and zoom ${width}px`, async ({ page }) => {
  await page.goto(`/session-tools?width=${width}&short=false`)
  const tools = page.locator('[data-mcp-inspector]')
  const row = tools.locator('.tools-activity-row').first()
  await row.locator('.tools-record-status').click()
  await expect(row).toHaveAttribute('data-selected', 'true')
  expect(await row.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
  await expect(tools.locator('.tools-call-details')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(row.locator('button')).toBeFocused()
  await tools.getByRole('button', { name: 'Timeline', exact: true }).click()
  await tools.locator('.tools-timeline-track').first().click()
  await expect(tools.locator('.tools-timeline-row').first()).toHaveAttribute('data-selected', 'true')
  await page.keyboard.press('Escape')
  // Emulate 200% page zoom: shrink the fixture's logical allocation while
  // scaling the page, so container queries see the same space as browser zoom.
  await page.evaluate(width => {
    document.body.style.zoom = '2'
    const fixture = document.getElementById('tools')!
    fixture.style.width = `${width / 2}px`
    fixture.style.height = '325px'
  }, width)
  await tools.locator('.tools-timeline-row button').first().click()
  const back = tools.getByRole('button', { name: 'Back', exact: true })
  await expect(back).toBeVisible()
  await expect(back).toBeFocused()
  const backBounds = await back.boundingBox(), paneBounds = await tools.boundingBox()
  expect(backBounds!.y + backBounds!.height).toBeLessThanOrEqual(paneBounds!.y + paneBounds!.height + 1)
  await back.click()
  await expect(tools.locator('.tools-timeline-row button').first()).toBeFocused()
  expect(await tools.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
})
