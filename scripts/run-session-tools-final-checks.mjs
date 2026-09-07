#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve,relative} from 'node:path'
const root=resolve(import.meta.dirname,'..')
const directory=resolve(root,'temp/integration-test-runs',`session-tools-final-${new Date().toISOString().replace(/[:.]/g,'-')}`)
mkdirSync(resolve(directory,'artifacts'),{recursive:true})
const packages=process.argv[2]==='--test-packages'?process.argv.slice(3):[]
if(packages.some(name=>!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(name)))throw new Error('Expected package names')
const commands=packages.length?[[...packages.flatMap(name=>['--filter',name]),'test']]:[['typecheck'],['test'],['check:bundles'],['check:plugins'],['check:surfaces']]
const redact=text=>String(text).replaceAll(root,'[PROJECT_ROOT]').replace(/(token|password|authorization|secret)\s*[:=]\s*\S+/gi,'$1=[REDACTED]')
const results=[];let stdout='',stderr=''
writeFileSync(resolve(directory,'command.txt'),commands.map(args=>`pnpm ${args.join(' ')}`).join('\n'))
writeFileSync(resolve(directory,'env.json'),JSON.stringify({node:process.version,platform:process.platform,paidCalls:false,redacted:true}))
for(const args of commands){
 const result=spawnSync('pnpm',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024})
 const out=redact(result.stdout??''),err=redact(result.stderr??result.error?.message??'')
 stdout+=out;stderr+=err
 writeFileSync(resolve(directory,'artifacts',`${args[0]}.log`),out+err)
 results.push({command:`pnpm ${args.join(' ')}`,exitCode:result.status??1})
 console.log(`${results.at(-1).command}: exit ${result.status??1}`)
}
const failed=results.some(result=>result.exitCode!==0)
writeFileSync(resolve(directory,'stdout.log'),stdout);writeFileSync(resolve(directory,'stderr.log'),stderr)
writeFileSync(resolve(directory,'summary.json'),JSON.stringify({status:failed?'failed':'passed',results,redacted:true},null,2))
console.log(`Evidence: ${relative(root,directory)}`);process.exitCode=failed?1:0
