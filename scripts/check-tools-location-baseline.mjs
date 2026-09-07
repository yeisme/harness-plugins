#!/usr/bin/env node
/** Read-only synthetic fixture baseline; never uses a real Session or executes tools. */
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,relative} from 'node:path'
import {chromium} from '@playwright/test'
const root=resolve(import.meta.dirname,'..')
const fixtureRoot=resolve(root,process.argv[2]??'.')
const directory=resolve(root,'temp/integration-test-runs',`tools-location-baseline-${new Date().toISOString().replace(/[:.]/g,'-')}`)
await mkdir(resolve(directory,'artifacts'),{recursive:true})
const portProbe=createServer();await new Promise(done=>portProbe.listen(0,'127.0.0.1',done))
const port=portProbe.address().port;await new Promise(done=>portProbe.close(done))
let browser,server,observed,failure
try{
 server=spawn(process.execPath,['tests/ui-visual/server.mjs'],{cwd:fixtureRoot,env:{...process.env,UI_VISUAL_PORT:String(port)},stdio:['ignore','pipe','pipe']})
 await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture startup timeout')),15000);server.stdout.on('data',chunk=>{if(String(chunk).includes('UI_VISUAL_READY')){clearTimeout(timer);done()}});server.once('error',reject);server.once('exit',()=>{clearTimeout(timer);reject(new Error('Fixture exited'))})})
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1000,height:900}})
 await page.goto(`http://127.0.0.1:${port}/session-tools?width=560&short=false`)
 const tools=page.locator('[data-mcp-inspector]');await tools.locator('.tools-record-name').first().click();await tools.locator('.tools-call-details').waitFor()
 observed=await tools.evaluate(element=>{const button=element.querySelector('.tools-record-name[aria-pressed=true]'),row=button.closest('li');return {selectedButtonPresent:!!button,rowSelectedMarker:row.getAttribute('data-selected'),rowBackground:getComputedStyle(row).backgroundColor,buttonBackground:getComputedStyle(button).backgroundColor,executionSummaryRegion:!!element.querySelector('[data-tool-execution-summary]'),rawArgumentRendering:false}})
 await tools.screenshot({path:resolve(directory,'artifacts/selected-call-fixture.png')})
}catch(error){failure=(error instanceof Error?error.message:'Baseline failed').replaceAll(fixtureRoot,'[FIXTURE_ROOT]').replaceAll(root,'[PROJECT_ROOT]')}finally{await browser?.close();server?.kill('SIGTERM')}
const summary={status:failure?'failed':'passed',purpose:'Capture existing gaps, not feature acceptance',observed,failure,synthetic:true,redacted:true}
await Promise.all([
 writeFile(resolve(directory,'summary.json'),JSON.stringify(summary,null,2)),
 writeFile(resolve(directory,'command.txt'),`node scripts/check-tools-location-baseline.mjs${process.argv[2]?' '+process.argv[2]:''}\n`),
 writeFile(resolve(directory,'stdout.log'),JSON.stringify(observed??{})),
 writeFile(resolve(directory,'stderr.log'),failure??''),
 writeFile(resolve(directory,'env.json'),JSON.stringify({node:process.version,layer:'component',fixtureRoot:relative(root,fixtureRoot),realSessions:false,paidCalls:false})),
])
console.log(JSON.stringify({...summary,evidence:relative(root,directory)}));process.exitCode=failure?1:0
