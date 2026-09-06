import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createReadStream, constants as fsConstants } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir, platform } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function firstExisting(paths) {
  for (const path of paths) {
    if (path === undefined) continue
    try {
      await access(path)
      return path
    } catch {}
  }
  return undefined
}

async function sha256(path) {
  if (path === undefined) return undefined
  return new Promise(resolveHash => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', chunk => hash.update(chunk))
    stream.once('error', () => resolveHash(undefined))
    stream.once('end', () => resolveHash(hash.digest('hex')))
  })
}

async function command(command, args) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 5_000, maxBuffer: 32 * 1024 })
    return (stdout || stderr).trim() || undefined
  } catch {
    return undefined
  }
}

function redactPath(projectRoot, path, label) {
  if (path === undefined) return undefined
  const projectRelative = relative(projectRoot, path)
  if (projectRelative !== '' && !projectRelative.startsWith('../')) return `<workspace>/${projectRelative}`
  return `<${label}>/${basename(path)}`
}

async function playwrightMetadata(projectRoot) {
  try {
    // Resolve the dependency chain rather than picking an arbitrary pnpm
    // store directory when multiple Playwright versions are installed.
    const rootRequire = createRequire(join(projectRoot, 'package.json'))
    const testPackage = rootRequire.resolve('@playwright/test/package.json')
    const playwrightPackage = createRequire(testPackage).resolve('playwright/package.json')
    const corePackage = createRequire(playwrightPackage).resolve('playwright-core/package.json')
    const root = resolve(corePackage, '..')
    const packageJson = JSON.parse(await readFile(corePackage, 'utf8'))
    const browsers = JSON.parse(await readFile(join(root, 'browsers.json'), 'utf8'))
    const headless = browsers.browsers?.find(browser => browser.name === 'chromium-headless-shell')
    return {
      status: 'available',
      root,
      version: typeof packageJson.version === 'string' ? packageJson.version : undefined,
      revision: typeof headless?.revision === 'string' ? headless.revision : undefined,
      browser_version: typeof headless?.browserVersion === 'string' ? headless.browserVersion : undefined,
    }
  } catch {
    return { status: 'unavailable', reason: 'playwright-core metadata could not be parsed' }
  }
}

function headlessPaths(cacheRoot, revision) {
  if (cacheRoot === undefined || revision === undefined) return []
  const folder = join(cacheRoot, `chromium_headless_shell-${revision}`)
  if (platform() === 'darwin') return [join(folder, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'), join(folder, 'chrome-headless-shell-mac-x64/chrome-headless-shell')]
  if (platform() === 'win32') return [join(folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe')]
  return [join(folder, 'chrome-headless-shell-linux64/chrome-headless-shell')]
}

async function resolveCacheExecutable(caches, revision) {
  for (const cache of caches) {
    const executable = await firstExisting(headlessPaths(cache.root, revision))
    if (executable !== undefined) return { ...cache, executable }
  }
  return caches[0] ?? { mode: 'unavailable-cache', root: undefined, label: 'unavailable' }
}

async function probeExecutable(path) {
  if (path === undefined) return { status: 'unavailable' }
  try {
    await access(path, fsConstants.X_OK)
  } catch {
    return { status: 'unavailable' }
  }
  const version = await command(path, ['--version'])
  // A successful arbitrary executable (for example `/bin/echo`) is not a
  // browser override. Accept the established Chromium version signatures.
  if (version === undefined || !/(?:Google Chrome|Chromium|Chrome Headless Shell)/iu.test(version)) return { status: 'unavailable' }
  return { status: 'available', version, sha256: await sha256(path) }
}

function fontField(output, field) {
  return output?.match(new RegExp(`^\\s*${field}:\\s*\\"([^\\"]+)\\"`, 'm'))?.[1]
}

function fontIndex(output) {
  const match = output?.match(/^\s*index:\s*(\d+)/m)
  return match === undefined ? undefined : Number(match[1])
}

async function fontMatch(pattern) {
  const output = await command('fc-match', ['-v', pattern])
  if (output === undefined) return { status: 'unavailable', pattern, reason: 'fc-match is unavailable' }
  const file = fontField(output, 'file')
  return {
    status: file === undefined ? 'unavailable' : 'available',
    pattern,
    family: fontField(output, 'family'),
    file: file === undefined ? undefined : `<font>/${basename(file)}`,
    index: fontIndex(output),
    sha256: await sha256(file),
  }
}

/**
 * Collect only reproducibility metadata. Values of arbitrary environment
 * variables and absolute host paths deliberately never enter the report.
 */
export async function collectVisualProvenance({ projectRoot = process.cwd() } = {}) {
  const metadata = await playwrightMetadata(projectRoot)
  const userOverride = process.env.DSH_TEST_CHROME_EXECUTABLE
  const browserCacheOverride = process.env.PLAYWRIGHT_BROWSERS_PATH
  const workspaceCache = resolve(projectRoot, 'temp/reference-playwright-browsers')
  const defaultCache = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'ms-playwright')
  const caches = browserCacheOverride === '0'
    ? [{ mode: 'local-playwright-cache', root: metadata.root === undefined ? undefined : join(metadata.root, '.local-browsers'), label: 'local-cache' }]
    : browserCacheOverride !== undefined && browserCacheOverride !== ''
      ? [{ mode: 'custom-playwright-cache', root: browserCacheOverride, label: 'custom-cache' }]
      : [
          { mode: 'workspace-pinned-cache', root: workspaceCache, label: 'workspace' },
          { mode: 'default-user-cache', root: defaultCache, label: 'user-cache' },
        ]
  const cache = userOverride !== undefined && userOverride !== ''
    ? { mode: 'explicit-executable-override', root: undefined, label: 'override' }
    : await resolveCacheExecutable(caches, metadata.revision)
  const candidate = userOverride !== undefined && userOverride !== '' ? userOverride : cache.executable
  const executableMode = userOverride !== undefined && userOverride !== '' ? 'explicit-override' : 'playwright-headless-shell'
  const executable = await probeExecutable(candidate)
  return {
    schema_version: 'yeisme.visual_provenance.v1',
    browser: {
      status: executable.status,
      selection: executableMode,
      executable: redactPath(projectRoot, candidate, cache.label),
      version: executable.version,
      sha256: executable.sha256,
      ...(executable.status === 'available' ? {} : { reason: 'matching Playwright chromium-headless-shell executable is unavailable or cannot report a version; no browser was installed' }),
      // Kept in memory for the runner only; omitted by serializeProvenance.
      executable_path: candidate,
    },
    playwright: {
      status: metadata.status,
      version: metadata.version,
      chromium_headless_shell_revision: metadata.revision,
      chromium_headless_shell_browser_version: metadata.browser_version,
      ...(metadata.reason === undefined ? {} : { reason: metadata.reason }),
    },
    cache: { mode: cache.mode },
    overrides_set: ['DSH_TEST_CHROME_EXECUTABLE', 'PLAYWRIGHT_BROWSERS_PATH'].filter(name => process.env[name] !== undefined),
    rendering: { device_scale_factor: 1 },
    fonts: {
      'Arial:lang=zh-cn': await fontMatch('Arial:lang=zh-cn'),
      'sans-serif:lang=zh-cn': await fontMatch('sans-serif:lang=zh-cn'),
      fontconfig_version: await command('fc-match', ['-V']),
      freetype_version: await command('freetype-config', ['--ftversion']) ?? await command('pkg-config', ['--modversion', 'freetype2']) ?? 'unavailable',
    },
  }
}

export function serializeProvenance(provenance) {
  const { executable_path, ...browser } = provenance.browser
  return { ...provenance, browser }
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(serializeProvenance(await collectVisualProvenance()), null, 2)}\n`)
}
