# Agent Note: DSH login-token remote access

Status: proposed

## Problem

`dsh web` historically bound only loopback and rejected `--host 0.0.0.0` because the `/api` Host/Origin fence is reachability protection, not authentication. Remote Web and a future remote TUI need a first-party login-token mechanism that does not depend on an external enterprise control plane.

## Proposal

Add a built-in token-store gate to `@deepseek-ai/dsh-client-connection`:

- `ConnectionConfig.tokenAuth.storePath` reads the digest-only store written by `dsh auth token`; inline tokens remain compatibility-only.
- Every `/api` HTTP request and both WebSocket downlinks require a valid token when `tokenAuth` is configured.
- Non-browser tokens may arrive as `Authorization: Bearer` or `x-dsh-access-token`.
- Browsers use `POST /api/auth/token`; the gate exchanges the access token for an opaque HttpOnly SameSite session and never puts the token in a URL or cookie.
- An `admin`-scoped token unlocks the privileged method set that otherwise remains loopback-only.

The web CLI teaches `--auth token-store` and allows `--host 0.0.0.0` only when digest-store auth is enabled. `--token` remains a deprecated compatibility ingress for one minor release. A new `dsh auth token create/list/revoke` family stores only SHA-256 token hashes under the DSH home.

This slice covers first-party token auth for remote Web, operator token create/list/revoke, dynamic digest verification, opaque browser sessions, and the same bearer surface a future remote TUI can reuse. It does not add OAuth/SSO or TLS/WSS termination.

## Alternatives considered

**Leave remote bind blocked until an external identity plane exists.** Rejected. Loopback-only Web already blocks LAN and remote TUI work; waiting for OAuth would keep `--host 0.0.0.0` unsupported with no first-party path.

**Treat `trustedHosts` as authentication.** Rejected. That list is a DNS-rebinding fence. Using it as a login would authorize any caller who can present a declared Host.

**Require an operator reverse-proxy or enterprise SSO before any remote bind.** Rejected as the only path. A reverse proxy remains the recommended TLS terminator, but a built-in token gate is the smallest first-party admission layer that does not invent a second identity product.

**Persist plaintext tokens in Web config.** Rejected for the taught path. Process arguments, environment inspection and generated profile config are broader exposure surfaces than the owner-only digest store.

## Acceptance criteria

- `--host 0.0.0.0` is accepted only when `--auth token-store` or the deprecated inline compatibility ingress supplies authentication.
- When `tokenAuth` is configured, every `/api` HTTP request and both WebSocket downlinks require a valid token; missing or invalid tokens receive `401` or a rejected upgrade.
- An `admin`-scoped token may reach the privileged method set that otherwise stays loopback-only.
- `dsh auth token create/list/revoke` stores only SHA-256 hashes under the DSH home, and revoke invalidates derived browser sessions on their next request.
- Focused specs stay green: `token-auth.host.spec.ts`, `startup.spec.ts`, `auth-store.spec.ts`, and `args.spec.ts`.

## Risks

An access token is a bearer secret. Logging, traces, URLs, cookies and fixtures must not echo it; the hash store is the only durable operator record.

The gate is admission, not transport security. Production remote bind still needs TLS at a reverse proxy; this change does not terminate TLS or replace network isolation.

An `admin` token unlocks the privileged method set across the LAN. Operators who share a web-scoped token must not reuse it as admin.
