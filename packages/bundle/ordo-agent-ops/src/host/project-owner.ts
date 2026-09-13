import { spawn } from 'node:child_process'
import { ProjectSessionLinksSchema, ProjectDraftSchema, ProjectEventsSchema, ProjectListSchema, ProjectReceiptSchema, ProjectRequestSchema, ProjectSnapshotSchema, type ProjectRequest } from '../project-contract.ts'

/** Async, shell-free transport. Project roots are resolved by Ordo registrations. */
export function executeProjectCli(argv: readonly string[], input?: unknown, signal?: AbortSignal, bin = process.env.ORDO_BIN ?? 'ordo'): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['project-ops', ...argv, '--json'], { stdio: ['pipe', 'pipe', 'ignore'], signal })
    let output = ''; let settled = false
    const finish = (error?: Error, value?: unknown): void => {
      if (settled) return
      settled = true; clearTimeout(timer)
      if (error) reject(error); else resolve(value)
    }
    const timer = setTimeout(() => { child.kill('SIGTERM'); finish(new Error('owner_timeout_unknown')) }, 20_000)
    const onError = () => finish(new Error('owner_unavailable'))
    const onData = (chunk: Buffer) => {
      if (settled) return
      output += String(chunk)
      if (Buffer.byteLength(output) > 8_388_608) { child.kill('SIGTERM'); finish(new Error('owner_response_too_large')) }
    }
    const onInputError = () => { /* Process exit is reported by close. */ }
    const onClose = (code: number | null) => {
      try {
        const envelope = JSON.parse(output)
        if (code !== 0 || envelope.status === 'failed' || !envelope.data) throw new Error()
        finish(undefined, envelope.data)
      } catch { finish(new Error('owner_operation_failed')) }
      finally {
        child.off('error', onError)
        child.stdout.off('data', onData)
        child.stdin.off('error', onInputError)
        child.off('close', onClose)
      }
    }
    child.on('error', onError)
    child.stdout.on('data', onData)
    child.stdin.on('error', onInputError)
    child.on('close', onClose)
    child.stdin.end(input === undefined ? undefined : JSON.stringify(input))
  })
}

export class OrdoProjectOwner {
  private readonly lifetime = new AbortController()
  constructor(private readonly exec: typeof executeProjectCli = executeProjectCli) {}
  async projects() { return ProjectListSchema.parse(await this.exec(['projects'], undefined, this.lifetime.signal)) }
  async sessionLinks(sessionRef: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(sessionRef)) throw new Error('invalid_session')
    return ProjectSessionLinksSchema.parse(await this.exec(['sessions', '--session', sessionRef], undefined, this.lifetime.signal))
  }
  async snapshot(projectRef: string) {
    await this.assertProject(projectRef)
    const result = await this.exec(['snapshot', '--project', projectRef], undefined, this.lifetime.signal) as { snapshot?: unknown }
    const snapshot = ProjectSnapshotSchema.parse(result.snapshot)
    if (snapshot.projectRef !== projectRef) throw new Error('project_mismatch')
    return snapshot
  }
  async events(projectRef: string, cursor: string) {
    await this.assertProject(projectRef)
    if (!/^[a-f0-9]{64}$/.test(cursor)) throw new Error('invalid_cursor')
    const result = ProjectEventsSchema.parse(await this.exec(['events', '--project', projectRef, '--cursor', cursor], undefined, this.lifetime.signal))
    if (result.projectRef !== projectRef) throw new Error('project_mismatch')
    return result
  }
  async draft(projectRef: string, targetRef: string) {
    await this.assertProject(projectRef)
    if (!/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,255}$/.test(targetRef)) throw new Error('invalid_target')
    const result = await this.exec(['draft', '--project', projectRef, '--target', targetRef], undefined, this.lifetime.signal) as { draft?: unknown }
    return ProjectDraftSchema.parse(result.draft)
  }
  async settlement(projectRef: string, requestId: string) {
    await this.assertProject(projectRef)
    if (!/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,255}$/.test(requestId)) throw new Error('invalid_request')
    const result = await this.exec(['settlement', '--project', projectRef, '--request', requestId], undefined, this.lifetime.signal) as { receipt?: unknown }
    const receipt = ProjectReceiptSchema.parse(result.receipt)
    if (receipt.projectRef !== projectRef || receipt.requestId !== requestId) throw new Error('receipt_context_mismatch')
    return receipt
  }
  async invoke(input: ProjectRequest) {
    const request = ProjectRequestSchema.parse(input)
    await this.assertProject(request.projectRef)
    const result = await this.exec(['invoke'], request, this.lifetime.signal) as { receipt?: unknown }
    const receipt = ProjectReceiptSchema.parse(result.receipt)
    if (receipt.projectRef !== request.projectRef || receipt.requestId !== request.requestId || receipt.action !== request.action || receipt.targetRef !== request.targetRef) throw new Error('receipt_context_mismatch')
    return receipt
  }
  private async assertProject(ref: string) {
    if (!(await this.projects()).projects.some(project => project.ref === ref)) throw new Error('project_not_registered')
  }
  dispose() { this.lifetime.abort() }
}
