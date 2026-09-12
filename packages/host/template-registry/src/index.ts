import { z } from 'zod'

export const TemplateStatus = z.enum(['ready','filling','confirming','compiled','exported','stale','degraded','disabled','unknown'])
export const TemplateSchema = z.object({
  ref: z.string().min(1), digest: z.string().min(1), title: z.string(), summary: z.string(),
  tags: z.array(z.string()).default([]), capabilities: z.array(z.string()).default([]),
  maturity: z.enum(['exploratory','first-support','mature']).default('exploratory'),
  rights: z.object({ preview: z.boolean(), export: z.boolean() }), source: z.enum(['local','remote','catalog']),
})
export const TemplateSessionSchema = z.object({
  id: z.string(), ref: z.string(), digest: z.string(), status: TemplateStatus,
  fields: z.record(z.string(), z.unknown()).default({}), confirmed: z.boolean().default(false),
  provider_calls: z.literal(0), updatedAt: z.string(),
})
export type Template = z.infer<typeof TemplateSchema>
export type TemplateSession = z.infer<typeof TemplateSessionSchema>
export type TemplateStatus = z.infer<typeof TemplateStatus>

export interface TemplateRegistryAdapter {
  list(input?: { query?: string; tag?: string; capability?: string }): Promise<Template[]>
  inspect(ref: string): Promise<Template | undefined>
  preview(ref: string): Promise<{ ref: string; text: string } | undefined>
  compile(input: { ref: string; digest: string; fields: Record<string, unknown>; confirmed: boolean }): Promise<{ session: TemplateSession; promptPackage: string }>
}

export function createTemplateSession(ref: string, digest: string): TemplateSession {
  return { id: crypto.randomUUID(), ref, digest, status: 'filling', fields: {}, confirmed: false, provider_calls: 0, updatedAt: new Date().toISOString() }
}

export function canCompile(session: TemplateSession, required: string[]): boolean {
  return session.status === 'filling' || session.status === 'confirming' ? session.confirmed && required.every(k => session.fields[k] !== undefined && session.fields[k] !== '') : false
}

export function markStale(session: TemplateSession, currentDigest: string): TemplateSession {
  return currentDigest === session.digest ? session : { ...session, status: 'stale' }
}
