import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

/** Serialize cooperating full verifiers without touching another process or its output. */
export async function acquireVerificationLock(root, { timeoutMs = 1_200_000, onWait = () => {} } = {}) {
  const dir = resolve(root, 'temp', 'full-plugin-verification.lock')
  const owner = JSON.stringify({ version: 1, pid: process.pid, nonce: randomUUID() })
  await mkdir(resolve(root, 'temp'), { recursive: true })
  const deadline = Date.now() + timeoutMs
  let notified = false
  for (;;) {
    try {
      await mkdir(dir)
      try {
        await writeFile(resolve(dir, 'owner.json'), owner, { flag: 'wx' })
      } catch (error) {
        await rm(dir, { recursive: true, force: true })
        throw error
      }
      break
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (!notified) { onWait(); notified = true }
      if (Date.now() >= deadline) {
        // A dead parent does not prove its build children have stopped. Never
        // steal/delete a stale lock automatically or kill the recorded PID.
        throw new Error('Plugin verification lock timed out. Check the previous verifier and its build children before removing the lock.')
      }
      await new Promise(done => setTimeout(done, 100))
    }
  }
  let released = false
  return async () => {
    if (released) return
    if (await readFile(resolve(dir, 'owner.json'), 'utf8') !== owner) {
      throw new Error('Plugin verification lock ownership changed; refusing to remove it.')
    }
    await rm(dir, { recursive: true })
    released = true
  }
}
