# Agent Note: DSH login-token remote access

Status: proposed

## Problem

`dsh web` historically bound only loopback and rejected `--host 0.0.0.0` because the `/api` Host/Origin fence is reachability protection, not authentication. Remote Web and a future remote TUI need a first-party login-token mechanism that does not depend on an external enterprise control plane.

## Decision

Add a built-in bearer-token gate to `@deepseek-ai/dsh-client-connection`:

- `ConnectionConfig.tokenAuth` accepts opaque tokens with optional scopes (`web`, `tui`, `admin`; default `admin`).
- Every `/api` HTTP request and both WebSocket downlinks require a valid token when `tokenAuth` is configured.
- Tokens may arrive as `Authorization: Bearer`, `x-dsh-access-token`, or the `__Host-dsh-access-token` cookie.
- An `admin`-scoped token unlocks the privileged method set that otherwise remains loopback-only.

The web CLI now accepts `--token <token>` and allows `--host 0.0.0.0` only when a token is supplied via the flag or `DSH_ACCESS_TOKEN`. A new `dsh auth token create/list/revoke` family stores only SHA-256 token hashes under the DSH home.

## Scope

- First-party token auth for remote Web.
- Management commands for creating/revoking tokens.
- A foundation for a future remote TUI: the same token gate protects the transport, and TUI clients can use the same bearer header/cookie surface.

## Non-goals

- OAuth/SSO integration and external identity providers.
- TLS/WSS termination (recommended through a reverse proxy in production).
- Persistent server-side token store verification; the current slice compares configured plaintext tokens and keeps the hash store as the operator management layer.

## Verification

- `packages/client/connection/tests/token-auth.host.spec.ts`
- `packages/bundle/web-app/tests/startup.spec.ts`
- `apps/cli/tests/auth-store.spec.ts`
- `apps/cli/tests/args.spec.ts`
