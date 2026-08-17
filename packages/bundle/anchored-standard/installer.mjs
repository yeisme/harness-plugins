/**
 * Anchored Standard preset installer for DeepSeek Harness.
 *
 * This module is the host-plugin entry of the @yeisme/dsh-anchored-standard
 * bundle. On boot it ensures the bundled presets exist in the user preset root
 * (`$DSH_HOME/.agent-presets`), so the DSH preset picker can offer:
 *
 * - `anchored-standard` — Minimal-aligned bootstrap, then full Standard tools.
 * - `zero-anchored-standard` — one zero-tool anchor turn, then Standard tools.
 * - `whoami-standard` — one self-introduction turn, then Standard tools.
 *
 * The installer is idempotent: it only copies a preset when the target
 * directory does not already exist. Existing user edits are never overwritten.
 */

import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'anchored-standard'

/** Root directory that contains the bundled preset directories. */
const PRESETS_ROOT = fileURLToPath(new URL('./presets/', import.meta.url))

/** Resolve the DSH home directory using the same precedence as the harness. */
export function dshHome(env = process.env) {
  return env.DSH_HOME ?? join(homedir(), '.dsh')
}

/** Resolve the user preset root. */
export function userPresetRoot(home = dshHome()) {
  return join(home, '.agent-presets')
}

/**
 * Install any bundled preset directory that is not already present.
 * @param ctx - Cordis context used only for logging.
 * @param presetRoot - optional preset root override (mainly for tests).
 * @returns the ids installed during this call.
 */
export function installBundledPresets(ctx, presetRoot = userPresetRoot()) {
  const installed = []
  const sourcePresets = readdirSync(PRESETS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  mkdirSync(presetRoot, { recursive: true })
  for (const id of sourcePresets) {
    const source = join(PRESETS_ROOT, id)
    const target = join(presetRoot, id)
    if (existsSync(target)) continue
    cpSync(source, target, { recursive: true })
    installed.push(id)
    ctx.logger.info(`anchored-standard: installed preset "${id}" -> ${target}`)
  }
  if (installed.length === 0) {
    ctx.logger.info('anchored-standard: bundled presets already installed')
  }
  return installed
}

/**
 * Register the idempotent preset installer with the DSH host lifecycle.
 * @param ctx - Host context.
 */
export function apply(ctx) {
  ctx.effect(() => {
    try {
      installBundledPresets(ctx)
    } catch (error) {
      ctx.logger.warn(`anchored-standard: failed to install bundled presets: ${String(error)}`)
    }
    return () => {}
  }, 'anchored-standard: install bundled presets')
}
