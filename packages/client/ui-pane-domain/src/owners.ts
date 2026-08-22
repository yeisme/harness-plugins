/** Canonical domain Pane owners. DSH never becomes the state owner. */

export const DOMAIN_OWNERS = ['eikona', 'sonora', 'auctra', 'pinax', 'anatomia', 'ordo'] as const
export type DomainOwner = (typeof DOMAIN_OWNERS)[number]

export const EIKONA_DEFAULT_MODEL = 'openai/gpt-5.4-image-2'

export const DOMAIN_PANE_KINDS: Record<DomainOwner, string> = {
  eikona: 'workspace.eikona',
  sonora: 'workspace.sonora',
  auctra: 'workspace.auctra',
  pinax: 'workspace.pinax',
  anatomia: 'workspace.anatomia',
  ordo: 'workspace.ordo-team',
}

export const DOMAIN_BADGES: Record<DomainOwner, string> = {
  eikona: 'Eikona',
  sonora: 'Sonora',
  auctra: 'Auctra',
  pinax: 'Pinax',
  anatomia: 'Anatomia',
  ordo: 'Ordo',
}

export const SUBAGENT_BADGE = 'Session Subagent'
