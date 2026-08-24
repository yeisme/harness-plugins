/**
 * Owner-action transport used by the Web command experience.
 *
 * The plugin only submits opaque refs and correlation ids. MSW fixtures
 * stand in for the owner when official DSH receipts are unavailable.
 */

export interface OwnerActionTransportRequest {
  readonly command: string;
  readonly correlationId: string;
  readonly targetRef?: string | null;
  readonly previewCapability?: string | null;
}

export interface OwnerActionTransportResponse {
  readonly status: 'pending' | 'success' | 'rejected' | 'failed' | 'stale';
  readonly correlationId: string;
  readonly preview?: {
    readonly targetRef?: string;
    readonly impactSummary?: string;
    readonly reversible?: boolean;
    readonly capability?: string;
    readonly danger?: 'safe' | 'confirm' | 'destructive';
  };
  readonly receipt?: {
    readonly id: string;
    readonly status: string;
    readonly error?: string;
  };
}

export interface OwnerActionTransport {
  readonly submit: (request: OwnerActionTransportRequest) => Promise<OwnerActionTransportResponse>;
  readonly cancel: (request: OwnerActionTransportRequest) => Promise<OwnerActionTransportResponse>;
  readonly listSessions: () => Promise<Array<{ id: string; title: string }>>;
  readonly listThreads: () => Promise<Array<{ id: string; title: string }>>;
}

const DEFAULT_BASE = 'https://api.deepseek.com/v1';

export function createOwnerActionTransport(
  fetchImpl: typeof fetch = fetch,
  baseUrl = DEFAULT_BASE,
): OwnerActionTransport {
  return {
    async submit(request) {
      const response = await fetchImpl(`${baseUrl}/commands/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          command: request.command,
          correlationId: request.correlationId,
          targetRef: request.targetRef ?? null,
          previewCapability: request.previewCapability ?? null,
        }),
      });
      return response.json() as Promise<OwnerActionTransportResponse>;
    },

    async cancel(request) {
      const response = await fetchImpl(`${baseUrl}/commands/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          command: request.command,
          correlationId: request.correlationId,
        }),
      });
      return response.json() as Promise<OwnerActionTransportResponse>;
    },

    async listSessions() {
      const response = await fetchImpl(`${baseUrl}/sessions`);
      const body = await response.json() as { sessions?: Array<{ id: string; title: string }> };
      return body.sessions ?? [];
    },

    async listThreads() {
      const response = await fetchImpl(`${baseUrl}/threads`);
      const body = await response.json() as { threads?: Array<{ id: string; title: string }> };
      return body.threads ?? [];
    },
  };
}
