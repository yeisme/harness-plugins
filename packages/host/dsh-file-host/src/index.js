/**
 * @yeisme/dsh-file-host.
 *
 * This package adapts DSH fs/attachment services into safe `FileEntryV1`
 * projections for the desktop workbench file tree and preview. It does not
 * own filesystem state or document parsing.
 *
 * @module @yeisme/dsh-file-host
 */
export const FILE_WATCH_CAPABILITY = 'FileWatchCapabilityV1';
export const FILE_TREE_PROJECTION_CAPABILITY = 'FileTreeProjectionCapabilityV1';
/** Optional Cordis context key used by Desktop Workbench when a real file owner is mounted. */
export const FILE_HOST_CONTEXT_KEY = 'dsh.fileHost';
/** Runtime guard for an owner-provided safe file projection service. */
export function isFileHostV1(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return candidate.version === '0.1.0-rc.1'
        && candidate.capability === 'file-host'
        && typeof candidate.listEntries === 'function'
        && (candidate.resolvePreviewUrl === undefined || typeof candidate.resolvePreviewUrl === 'function')
        && (candidate.readText === undefined || typeof candidate.readText === 'function')
        && (candidate.watch === undefined || typeof candidate.watch === 'function');
}
const UNSAFE_WATCH = /(?:^|[:/\\])(?:etc|home|usr|var|tmp)|file:\/\/|authorization|cookie|token/i;
export function isSafeFileWatchEvent(event) {
    const blob = `${event.cursor}|${event.entryRef}|${event.parentRef ?? ''}|${event.occurredAt}`;
    return event.entryRef.length > 0
        && event.entryRef.length <= 160
        && event.cursor.length > 0
        && !UNSAFE_WATCH.test(blob);
}
const UNSAFE_TREE = /(?:^|[:/\\])(?:etc|home|usr|var|tmp)|file:\/\/|authorization|cookie|token/i;
const OPAQUE_REF = /^[A-Za-z0-9._~:-]{1,160}$/;
const SAFE_NAME = /^[^\\/\r\n]{1,200}$/;
function looksLikeAbsolutePath(value) {
    return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\') || value.startsWith('file:');
}
export function isSafeFileTreeRef(value) {
    return OPAQUE_REF.test(value) && !looksLikeAbsolutePath(value) && !UNSAFE_TREE.test(value);
}
export function isSafeFileTreeNode(node) {
    if (!isSafeFileTreeRef(node.ref))
        return false;
    if (node.parentRef !== undefined && !isSafeFileTreeRef(node.parentRef))
        return false;
    if (!SAFE_NAME.test(node.name) || looksLikeAbsolutePath(node.name))
        return false;
    if (node.version.length === 0 || node.version.length > 80 || looksLikeAbsolutePath(node.version))
        return false;
    const blob = `${node.ref}|${node.parentRef ?? ''}|${node.name}|${node.version}|${node.gitDecoration ?? ''}`;
    return !UNSAFE_TREE.test(blob) && !looksLikeAbsolutePath(blob);
}
export function validateFileTreeNode(value) {
    if (typeof value !== 'object' || value === null)
        return { ok: false, reason: 'node must be an object' };
    const candidate = value;
    if (typeof candidate.ref !== 'string' || !isSafeFileTreeRef(candidate.ref))
        return { ok: false, reason: 'unsafe ref' };
    if (candidate.parentRef !== undefined && (typeof candidate.parentRef !== 'string' || !isSafeFileTreeRef(candidate.parentRef))) {
        return { ok: false, reason: 'unsafe parentRef' };
    }
    if (typeof candidate.name !== 'string' || !SAFE_NAME.test(candidate.name) || looksLikeAbsolutePath(candidate.name)) {
        return { ok: false, reason: 'unsafe name' };
    }
    if (candidate.kind !== 'file' && candidate.kind !== 'directory' && candidate.kind !== 'symlink') {
        return { ok: false, reason: 'invalid kind' };
    }
    if (typeof candidate.version !== 'string' || candidate.version.length === 0)
        return { ok: false, reason: 'missing version' };
    if (typeof candidate.hasChildren !== 'boolean')
        return { ok: false, reason: 'hasChildren required' };
    if (!Array.isArray(candidate.capabilities) || candidate.capabilities.some(item => typeof item !== 'string')) {
        return { ok: false, reason: 'capabilities invalid' };
    }
    const node = {
        ref: candidate.ref,
        ...(candidate.parentRef === undefined ? {} : { parentRef: candidate.parentRef }),
        name: candidate.name,
        kind: candidate.kind,
        version: candidate.version,
        hasChildren: candidate.hasChildren,
        capabilities: [...candidate.capabilities],
        ...(typeof candidate.gitDecoration === 'string' ? { gitDecoration: candidate.gitDecoration } : {}),
        ...(candidate.symlinkKind === 'file' || candidate.symlinkKind === 'directory' || candidate.symlinkKind === 'unknown'
            ? { symlinkKind: candidate.symlinkKind }
            : {}),
        freshness: candidate.freshness === 'fresh' || candidate.freshness === 'stale' || candidate.freshness === 'offline' || candidate.freshness === 'unknown' || candidate.freshness === 'contract_mismatch'
            ? candidate.freshness
            : 'unknown',
    };
    if (!isSafeFileTreeNode(node))
        return { ok: false, reason: 'contract_mismatch' };
    return { ok: true, value: node };
}
export function validateFileTreeBreadcrumb(segments) {
    return segments.every(segment => isSafeFileTreeRef(segment.ref) && SAFE_NAME.test(segment.name) && !looksLikeAbsolutePath(segment.name));
}
export function probeFileTreeProjection(host) {
    if (host === undefined) {
        return { available: false, freshness: 'offline', reason: 'file owner is offline' };
    }
    const capabilities = host.capabilities ?? [];
    if (!capabilities.includes(FILE_TREE_PROJECTION_CAPABILITY) || host.tree === undefined) {
        return {
            available: false,
            freshness: 'contract_mismatch',
            missingCapability: FILE_TREE_PROJECTION_CAPABILITY,
            reason: `missing ${FILE_TREE_PROJECTION_CAPABILITY}`,
        };
    }
    return { available: true, freshness: 'fresh', reason: 'file tree projection available' };
}
/** Probe live watch. Missing capability is not live and must not be polled. */
export function probeFileWatch(host) {
    if (host === undefined) {
        return { live: false, freshness: 'offline', reason: 'file owner is offline' };
    }
    const capabilities = host.capabilities ?? [];
    if (!capabilities.includes(FILE_WATCH_CAPABILITY) || typeof host.watch !== 'function') {
        return {
            live: false,
            freshness: 'contract_mismatch',
            missingCapability: FILE_WATCH_CAPABILITY,
            reason: `missing ${FILE_WATCH_CAPABILITY}`,
        };
    }
    return { live: true, freshness: 'fresh', reason: 'file watch available' };
}
/** Placeholder host adapter used until real DSH fs/attachment seams are wired. */
export function createFileHostPlaceholder() {
    return {
        version: '0.1.0-rc.1',
        capability: 'file-host',
        async listEntries() {
            return [];
        },
    };
}
const ID_PREFIX = 'dir-';
const ID_RE = /^[A-Za-z0-9._~-]{1,128}$/;
function hashPath(path) {
    let hash = 2166136261;
    for (let index = 0; index < path.length; index += 1) {
        hash ^= path.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}
/**
 * On-demand FileHostV1 over DSH `ctx.workspaces.listDirectory`.
 *
 * Host paths stay in an internal map. Projections are opaque directory
 * entries only. This adapter never claims FileWatchCapabilityV1.
 */
export function createFileHostFromWorkspaces(listDirectory, resolveRootPath) {
    const paths = new Map();
    const entryIdFor = (path) => {
        const id = `${ID_PREFIX}${hashPath(path)}`;
        paths.set(id, path);
        return id;
    };
    const mapListing = (listing, parentId) => listing.entries
        .filter(entry => entry.hidden !== true)
        .flatMap(entry => {
        if (entry.name.length === 0 || entry.name.length > 200 || /[\\/\r\n]/.test(entry.name)) {
            return [];
        }
        const id = entryIdFor(entry.path);
        if (!ID_RE.test(id))
            return [];
        const projected = {
            id,
            ...(parentId === undefined ? {} : { parentId }),
            name: entry.name,
            kind: 'directory',
            capabilities: ['open'],
        };
        return [projected];
    });
    return {
        version: '0.1.0-rc.1',
        capability: 'file-host',
        async listEntries(parentRef) {
            if (parentRef === undefined) {
                const listing = await listDirectory(resolveRootPath?.());
                return mapListing(listing);
            }
            const path = paths.get(parentRef);
            if (path === undefined)
                return [];
            const listing = await listDirectory(path);
            return mapListing(listing, parentRef);
        },
    };
}
const TEXT_EXT = new Set([
    '.md', '.txt', '.json', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html', '.htm',
    '.yml', '.yaml', '.toml', '.xml', '.sh', '.go', '.rs', '.py', '.svg',
]);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif', '.ico']);
const ARCHIVE_EXT = new Set(['.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z']);
function extensionOf(name) {
    const at = name.lastIndexOf('.');
    return at <= 0 ? '' : name.slice(at).toLowerCase();
}
function kindFromEntry(name, isDir) {
    if (isDir)
        return 'directory';
    const ext = extensionOf(name);
    if (TEXT_EXT.has(ext))
        return 'text';
    if (IMAGE_EXT.has(ext))
        return 'image';
    if (ext === '.pdf')
        return 'pdf';
    if (ARCHIVE_EXT.has(ext))
        return 'archive';
    return 'file';
}
function mediaTypeOf(kind, name) {
    const ext = extensionOf(name);
    if (kind === 'text') {
        if (ext === '.json')
            return 'application/json';
        if (ext === '.md')
            return 'text/markdown';
        if (ext === '.html' || ext === '.htm')
            return 'text/html';
        return 'text/plain';
    }
    if (kind === 'pdf')
        return 'application/pdf';
    if (kind === 'image') {
        if (ext === '.png')
            return 'image/png';
        if (ext === '.jpg' || ext === '.jpeg')
            return 'image/jpeg';
        if (ext === '.gif')
            return 'image/gif';
        if (ext === '.webp')
            return 'image/webp';
        if (ext === '.svg')
            return 'image/svg+xml';
        return 'image/*';
    }
    return undefined;
}
function capabilitiesOf(kind) {
    if (kind === 'directory')
        return ['open'];
    if (kind === 'text' || kind === 'pdf' || kind === 'image' || kind === 'document')
        return ['preview', 'open'];
    return ['open'];
}
/**
 * On-demand FileHostV1 over a host explorer listing that includes files.
 *
 * Adapted from the DSH-better-sidebar explorer contract (`fs.tree` / `fs.read`):
 * list one workspace level with file rows, keep host paths off the projection,
 * and optionally read text for preview. Does not claim FileWatchCapabilityV1.
 */
export function createFileHostFromWorkspaceTree(listTree, options) {
    const paths = new Map();
    const entryIdFor = (path, isDir) => {
        const id = `${isDir ? 'dir' : 'file'}-${hashPath(path)}`;
        paths.set(id, path);
        return id;
    };
    const mapListing = (listing, parentId) => listing.entries
        .filter(entry => entry.hidden !== true)
        .flatMap(entry => {
        if (entry.name.length === 0 || entry.name.length > 200 || /[\\/\r\n]/.test(entry.name)) {
            return [];
        }
        const kind = kindFromEntry(entry.name, entry.isDir);
        const id = entryIdFor(entry.path, entry.isDir);
        if (!ID_RE.test(id))
            return [];
        const mediaType = mediaTypeOf(kind, entry.name);
        const projected = {
            id,
            ...(parentId === undefined ? {} : { parentId }),
            name: entry.name,
            kind,
            ...(mediaType === undefined ? {} : { mediaType }),
            capabilities: capabilitiesOf(kind),
        };
        return [projected];
    });
    const host = {
        version: '0.1.0-rc.1',
        capability: 'file-host',
        async listEntries(parentRef) {
            if (parentRef === undefined) {
                const listing = await listTree(options?.resolveRootPath?.());
                return mapListing(listing);
            }
            const path = paths.get(parentRef);
            if (path === undefined)
                return [];
            const listing = await listTree(path);
            return mapListing(listing, parentRef);
        },
    };
    if (options?.readText === undefined)
        return host;
    return {
        ...host,
        async readText(entry) {
            if (entry.kind === 'directory')
                return undefined;
            const path = paths.get(entry.id);
            if (path === undefined)
                return undefined;
            return options.readText(path);
        },
    };
}
/**
 * Browser FileHostV1 over `/yeisme-files/api` (`fs.tree` / `fs.read`).
 * Same explorer contract as DSH-better-sidebar, different route prefix.
 */
export function createExplorerFileHost(options = {}) {
    const fetchFn = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
    if (fetchFn === undefined) {
        return createFileHostPlaceholder();
    }
    const call = async (method, extra) => {
        const sessionId = options.sessionId?.();
        const cwd = options.cwd?.();
        const response = await fetchFn(`/yeisme-files/api/${method}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                ...(sessionId === undefined || sessionId === '' ? {} : { sessionId }),
                ...(cwd === undefined || cwd === '' ? {} : { cwd }),
                ...extra,
            }),
        });
        const parsed = await response.json();
        if (parsed.ok !== true) {
            throw new Error(parsed.error?.message ?? `HTTP ${response.status}`);
        }
        return parsed.value;
    };
    return createFileHostFromWorkspaceTree(async (path) => call('fs.tree', path === undefined ? {} : { path }), {
        readText: async (path) => call('fs.read', { path }),
    });
}
/** Browser Git host over `/yeisme-files/api/git.*` typed methods. */
export function createExplorerGitHost(options = {}) {
    const fetchFn = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
    if (fetchFn === undefined)
        return undefined;
    const call = async (method, extra = {}) => {
        const sessionId = options.sessionId?.();
        const cwd = options.cwd?.();
        const response = await fetchFn(`/yeisme-files/api/${method}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                ...(sessionId === undefined || sessionId === '' ? {} : { sessionId }),
                ...(cwd === undefined || cwd === '' ? {} : { cwd }),
                ...extra,
            }),
        });
        const parsed = await response.json();
        if (parsed.ok !== true) {
            throw new Error(parsed.error?.message ?? `HTTP ${response.status}`);
        }
        return parsed.value;
    };
    return {
        capabilities: ['GitTypedActionsCapabilityV1'],
        status: async () => call('git.status'),
        diff: async (path) => call('git.diff', { path }),
        stage: async (path) => call('git.stage', { path }),
        unstage: async (path) => call('git.unstage', { path }),
        commit: async (message) => call('git.commit', { message }),
    };
}
