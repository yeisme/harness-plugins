import {test,expect} from '@playwright/test'
for(const width of [360,560,960])for(const short of [false,true])test(`session tools ${width}px ${short?'short':'normal'} keeps calls and selected details reachable`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(`/session-tools?width=${width}&short=${short}`)
  const tools=page.locator('[data-mcp-inspector]'),list=tools.locator('.tools-activity-list')
  await expect(tools).toBeVisible()
  const rect=await list.boundingBox();expect(rect?.height).toBeGreaterThan(15)
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
