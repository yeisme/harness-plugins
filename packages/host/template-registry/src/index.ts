/**
 * Package surface for the DSH template-registry plugin
 * (dsh-template-registry-integration-v1).
 *
 * The frozen 1.2 contract layer (safe-projection zod schemas, compile-session
 * state machine, storage domain, MCP consumption set) lives in contracts.ts;
 * the 2.x host layers are implemented in sibling modules:
 * - transport.ts — fixed-argv stdio MCP connection (spawn factory injected);
 * - catalog.ts — promptrepo catalog.json degraded browse (read-only);
 * - rpc.ts — typed list/search/inspect/preview RPCs, rights fail-closed;
 * - sessions.ts — compile-session RPCs (fill/confirm/compile/export, CAS);
 * - store.ts — yeisme_template_registry_v1 storage-domain persistence;
 * - projection.ts — templateRegistryCompile session projection unit;
 * - service.ts — connection manager, capability probe, degradation.
 * Everything is re-exported here under the same names the scaffold
 * committed (1.2 compatibility: no frozen export changed name or shape).
 *
 * @module @yeisme/dsh-template-registry
 */

export * from './contracts.js'
export * from './transport.js'
export * from './catalog.js'
export * from './rpc.js'
export * from './sessions.js'
export * from './store.js'
export * from './projection.js'
export * from './service.js'
