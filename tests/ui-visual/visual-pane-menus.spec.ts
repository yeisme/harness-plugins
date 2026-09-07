import {test,expect} from '@playwright/test'
for(const width of [360,960]){
 test(`Tools native More keyboard and activation ${width}`,async({page})=>{
  await page.setViewportSize({width,height:800});await page.goto('/pane-menus?kind=tools')
  const trigger=page.getByRole('button',{name:'More',exact:true});await trigger.focus();await page.keyboard.press('Enter')
  const items=page.getByRole('menuitem').filter({hasNot:page.locator('[disabled]')})
  await expect(items.first()).toBeFocused();await page.keyboard.press('End');await expect(items.last()).toBeFocused()
  await page.keyboard.press('Home');await expect(items.first()).toBeFocused();await page.keyboard.press('Escape');await expect(trigger).toBeFocused()
  await trigger.click();await page.getByRole('menuitem',{name:'Manage global tools'}).click()
  expect(await page.evaluate(()=>(window as unknown as {__menuAction:string}).__menuAction)).toBe('tools-manager')
  await expect(trigger).toBeFocused()
 })
 test(`Explorer native row menu and confirmation ${width}`,async({page})=>{
  await page.setViewportSize({width,height:800});await page.goto('/pane-menus?kind=explorer')
  const tree=page.getByRole('tree');await tree.focus();await page.keyboard.press('Shift+F10')
  await expect(page.getByRole('menuitem',{name:'新建文件',exact:true})).toBeFocused()
  await page.keyboard.press('ArrowDown');await expect(page.getByRole('menuitem',{name:'新建目录',exact:true})).toBeFocused()
  await page.keyboard.press('Escape');await expect(tree).toBeFocused()
  await page.locator('[data-explorer-ref=two]').click({button:'right'})
  const menu=page.getByRole('menu'),rect=await menu.boundingBox();expect(rect).not.toBeNull();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(width+1)
  await page.getByRole('menuitem',{name:'移到废纸篓',exact:true}).click()
  await expect(page.getByRole('button',{name:'确认执行',exact:true})).toBeFocused()
  expect(await page.evaluate(()=>(window as unknown as {__menuAction:string}).__menuAction)).toBe('')
  await page.keyboard.press('Escape');await expect(tree).toBeFocused();await expect(tree).toHaveAttribute('aria-activedescendant','explorer-row-two')
 })
}

test('Explorer menu stays reachable in a short touch Pane',async({browser})=>{
 const context=await browser.newContext({viewport:{width:360,height:800},hasTouch:true,baseURL:'http://127.0.0.1:4178'})
 try{
  const page=await context.newPage();await page.goto('/pane-menus?kind=explorer')
  await page.locator('#fixture').evaluate(element=>{element.style.height='160px'})
  await page.getByRole('tree').focus();await page.keyboard.press('Shift+F10')
  const menu=page.locator('.pwr-explorer-context-menu'),rect=await menu.boundingBox()
  expect(rect!.y+rect!.height).toBeLessThanOrEqual(161)
  expect((await page.getByRole('menuitem',{name:'新建文件',exact:true}).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.keyboard.press('End');await expect(page.getByRole('menuitem',{name:'取消',exact:true})).toBeFocused()
  await page.keyboard.press('Escape');await expect(page.getByRole('tree')).toBeFocused()
 }finally{await context.close()}
})
