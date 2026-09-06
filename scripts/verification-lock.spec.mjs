import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { acquireVerificationLock } from './verification-lock.mjs'

test('a second process cannot enter until the first verifier releases its lock', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'dsh-verifier-lock-'))
  const release = await acquireVerificationLock(root)
  const helper = new URL('./verification-lock.mjs', import.meta.url).href
  const marker = resolve(root, 'entered.txt')
  const source = `import {acquireVerificationLock} from ${JSON.stringify(helper)};
    import {writeFile} from 'node:fs/promises';
    const release=await acquireVerificationLock(${JSON.stringify(root)}, {onWait:()=>console.log('waiting')});
    await writeFile(${JSON.stringify(marker)},'entered'); await release();`
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'pipe', 'pipe'] })
  const closed = new Promise((done, fail) => { child.once('error', fail); child.once('close', code => done(code)) })
  try {
    await new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error('second verifier did not wait')), 5000)
      child.stdout.once('data', () => { clearTimeout(timer); done() })
    })
    await assert.rejects(readFile(marker), { code: 'ENOENT' })
    await release()
    assert.equal(await closed, 0)
    assert.equal(await readFile(marker, 'utf8'), 'entered')
  } finally {
    child.kill('SIGTERM')
    await closed
    await release()
    await rm(root, { recursive: true, force: true })
  }
})

test('a timeout preserves the first verifier lock', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'dsh-verifier-lock-'))
  const release = await acquireVerificationLock(root)
  const path = resolve(root, 'temp/full-plugin-verification.lock/owner.json')
  try {
    const original = await readFile(path, 'utf8')
    await assert.rejects(acquireVerificationLock(root, { timeoutMs: 1 }), /timed out/)
    assert.equal(await readFile(path, 'utf8'), original)
  } finally {
    await release()
    await rm(root, { recursive: true, force: true })
  }
})
