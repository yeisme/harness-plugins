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
export const FILE_TREE_PROJECTION_CAPABILITY_V2 = 'FileTreeProjectionCapabilityV2';
export const FILE_INSPECT_CAPABILITY = 'FileInspectCapabilityV1';
export const FILE_TEXT_WRITE_CAPABILITY = 'FileTextWriteCapabilityV1';
export const FILE_OPAQUE_REF_CAPABILITY = 'FileOpaqueRefCapabilityV1';
export const FILE_WORKSPACE_EDIT_CAPABILITY = 'FileWorkspaceEditCapabilityV1';
export function probeFileOpaqueRefs(host) {
    const available = host?.capabilities?.includes(FILE_OPAQUE_REF_CAPABILITY) === true;
    return {
        available,
        capability: FILE_OPAQUE_REF_CAPABILITY,
        reason: available ? 'opaque file refs available' : `missing ${FILE_OPAQUE_REF_CAPABILITY}`,
    };
}
export function isSafeFileTreeNodeV2(node) {
    if (!isSafeFileTreeRef(node.ref) || (node.parentRef !== undefined && !isSafeFileTreeRef(node.parentRef)))
        return false;
    if (!SAFE_NAME.test(node.name) || looksLikeAbsolutePath(node.name) || node.version.length === 0 || node.version.length > 120)
        return false;
    if (node.kind !== 'file' && node.kind !== 'directory' && node.kind !== 'symlink')
        return false;
    if (typeof node.hidden !== 'boolean' || typeof node.ignored !== 'boolean' || typeof node.sensitive !== 'boolean')
        return false;
    if (node.symlink !== undefined && node.kind !== 'symlink')
        return false;
    return !UNSAFE_TREE.test(`${node.ref}|${node.parentRef ?? ''}|${node.name}|${node.version}`);
}
export function validateFileTreePageV2(value) {
    if (typeof value !== 'object' || value === null)
        return { ok: false, reason: 'page must be an object' };
    const candidate = value;
    if (typeof candidate.workspaceRef !== 'string' || !isSafeFileTreeRef(candidate.workspaceRef.replace(/^workspace:/, 'w:')))
        return { ok: false, reason: 'unsafe workspaceRef' };
    if (typeof candidate.generation !== 'string' || candidate.generation.length === 0 || candidate.generation.length > 120)
        return { ok: false, reason: 'invalid generation' };
    if (typeof candidate.revision !== 'string' || candidate.revision.length === 0 || candidate.revision.length > 120)
        return { ok: false, reason: 'invalid revision' };
    if (typeof candidate.truncated !== 'boolean' || typeof candidate.loaded !== 'number' || !Array.isArray(candidate.nodes) || candidate.nodes.some(node => !isSafeFileTreeNodeV2(node)))
        return { ok: false, reason: 'invalid nodes' };
    return { ok: true, value: candidate };
}
export const FILE_RESOURCE_MUTATION_CAPABILITY_V1 = 'FileResourceMutationCapabilityV1';
export const FILE_TRANSFER_CAPABILITY_V1 = 'FileTransferCapabilityV1';
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
        && (candidate.readBinary === undefined || typeof candidate.readBinary === 'function')
        && (candidate.writeText === undefined || typeof candidate.writeText === 'function')
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
export function probeFileTreeProjectionV2(host) {
    if (host === undefined)
        return { available: false, freshness: 'offline', reason: 'file owner is offline' };
    if (!host.capabilities?.includes(FILE_TREE_PROJECTION_CAPABILITY_V2) || host.treeV2 === undefined)
        return { available: false, freshness: 'contract_mismatch', missingCapability: FILE_TREE_PROJECTION_CAPABILITY_V2, reason: `missing ${FILE_TREE_PROJECTION_CAPABILITY_V2}` };
    return { available: true, freshness: 'fresh', reason: 'file tree projection v2 available' };
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
const DOCUMENT_EXT = new Set(['.docx']);
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
    if (DOCUMENT_EXT.has(ext))
        return 'document';
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
    if (kind === 'document' && ext === '.docx')
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
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
    if (ext === '.mp3')
        return 'audio/mpeg';
    if (ext === '.wav')
        return 'audio/wav';
    if (ext === '.ogg')
        return 'audio/ogg';
    if (ext === '.m4a')
        return 'audio/mp4';
    if (ext === '.flac')
        return 'audio/flac';
    if (ext === '.aac')
        return 'audio/aac';
    if (ext === '.mp4' || ext === '.m4v')
        return 'video/mp4';
    if (ext === '.webm')
        return 'video/webm';
    if (ext === '.ogv')
        return 'video/ogg';
    if (ext === '.mov')
        return 'video/quicktime';
    return undefined;
}
function capabilitiesOf(kind, mediaType, editable = false) {
    if (kind === 'directory')
        return ['open'];
    if (kind === 'text')
        return editable ? ['preview', 'open', 'edit'] : ['preview', 'open'];
    if (kind === 'pdf' || kind === 'image' || kind === 'document')
        return ['preview', 'open'];
    if (mediaType?.startsWith('audio/') || mediaType?.startsWith('video/'))
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
            capabilities: capabilitiesOf(kind, mediaType, options?.writeText !== undefined),
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
    if (options?.readText === undefined && options?.readBinary === undefined && options?.writeText === undefined)
        return host;
    return {
        ...host,
        ...(options?.readText === undefined ? {} : { async readText(entry) {
                if (entry.kind === 'directory')
                    return undefined;
                const path = paths.get(entry.id);
                if (path === undefined)
                    return undefined;
                return options.readText(path);
            } }),
        ...(options?.readBinary === undefined ? {} : { async readBinary(entry) {
                if (entry.kind === 'directory' || !entry.capabilities.includes('preview'))
                    return undefined;
                const path = paths.get(entry.id);
                if (path === undefined)
                    return undefined;
                const result = await options.readBinary(path);
                return entry.mediaType === undefined ? result : { ...result, mediaType: entry.mediaType };
            } }),
        ...(options?.writeText === undefined ? {} : { async writeText(entry, content, expectedVersion) {
                if (entry.kind !== 'text' || !entry.capabilities.includes('edit'))
                    return { status: 'rejected', reason: 'file is read-only' };
                const path = paths.get(entry.id);
                if (path === undefined)
                    return { status: 'rejected', reason: 'file is unavailable' };
                return options.writeText(path, content, expectedVersion);
            } }),
        capabilities: options?.writeText === undefined ? host.capabilities : [FILE_TEXT_WRITE_CAPABILITY],
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
    const request = async (method, extra, includeClientCwd) => {
        const sessionId = options.sessionId?.();
        const cwd = options.cwd?.();
        const signal = options.signal?.();
        const response = await fetchFn(`/yeisme-files/api/${method}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                ...(sessionId === undefined || sessionId === '' ? {} : { sessionId }),
                ...(!includeClientCwd || cwd === undefined || cwd === '' ? {} : { cwd }),
                ...extra,
            }),
            ...(signal === undefined ? {} : { signal }),
        });
        const parsed = await response.json();
        if (parsed.ok !== true) {
            throw new Error(parsed.error?.message ?? `HTTP ${response.status}`);
        }
        return parsed.value;
    };
    const call = (method, extra) => request(method, extra, true);
    const callOpaque = (method, extra) => request(method, extra, false);
    const readBinary = async (path) => {
        const value = await call('fs.binary', { path });
        if (typeof value.base64 !== 'string' || typeof value.size !== 'number' || typeof value.truncated !== 'boolean') {
            throw new Error('invalid binary file response');
        }
        const decoded = atob(value.base64);
        const bytes = new Uint8Array(decoded.length);
        for (let index = 0; index < decoded.length; index += 1)
            bytes[index] = decoded.charCodeAt(index);
        return {
            bytes,
            size: value.size,
            truncated: value.truncated,
            ...(typeof value.version === 'string' ? { version: value.version } : {}),
        };
    };
    const legacyHost = createFileHostFromWorkspaceTree(async (path) => call('fs.tree', path === undefined ? {} : { path }), {
        readText: async (path) => call('fs.read', { path }),
        readBinary,
        writeText: async (path, content, expectedVersion) => call('fs.write', { path, content, expectedVersion }),
    });
    let opaqueRefsAvailable = false;
    let ownerCapabilities = new Set();
    const revealTokens = new Map();
    const isOpaqueEntry = (entry) => {
        if (typeof entry !== 'object' || entry === null)
            return false;
        const candidate = entry;
        return typeof candidate.id === 'string'
            && ID_RE.test(candidate.id)
            && typeof candidate.name === 'string'
            && candidate.name.length > 0
            && candidate.name.length <= 200
            && !/[\\/\r\n]/.test(candidate.name)
            && typeof candidate.kind === 'string'
            && ['file', 'directory', 'document', 'pdf', 'text', 'image', 'archive', 'binary'].includes(candidate.kind)
            && Array.isArray(candidate.capabilities)
            && candidate.capabilities.every(capability => ['preview', 'open', 'download', 'edit'].includes(capability));
    };
    const parseEntries = (value) => {
        if (!Array.isArray(value) || value.some(entry => !isOpaqueEntry(entry)))
            return undefined;
        return value;
    };
    const opaqueHost = {
        version: '0.1.0-rc.1',
        capability: 'file-host',
        get capabilities() {
            const legacy = legacyHost.capabilities ?? [];
            return opaqueRefsAvailable
                ? [...new Set([...legacy, FILE_OPAQUE_REF_CAPABILITY, FILE_TREE_PROJECTION_CAPABILITY_V2, ...ownerCapabilities])]
                : legacy;
        },
        async listEntries(parentRef) {
            try {
                const entries = parseEntries(await callOpaque('fs.treeV2', parentRef === undefined ? {} : { parentRef }));
                if (entries !== undefined) {
                    opaqueRefsAvailable = true;
                    return entries;
                }
            }
            catch {
                // Additive compatibility: old hosts keep the existing path-backed adapter.
            }
            opaqueRefsAvailable = false;
            return legacyHost.listEntries(parentRef);
        },
        async readText(entry) {
            if (opaqueRefsAvailable) {
                const reveal = revealTokens.get(entry.id);
                return callOpaque('fs.readV2', { ref: entry.id, ...(reveal === undefined ? {} : { revealToken: reveal.token }) });
            }
            return legacyHost.readText?.(entry);
        },
        async readBinary(entry) {
            if (opaqueRefsAvailable) {
                const reveal = revealTokens.get(entry.id);
                const value = await callOpaque('fs.binaryV2', { ref: entry.id, ...(reveal === undefined ? {} : { revealToken: reveal.token }) });
                if (typeof value.base64 !== 'string' || typeof value.size !== 'number' || typeof value.truncated !== 'boolean') {
                    throw new Error('invalid opaque binary file response');
                }
                const decoded = atob(value.base64);
                const bytes = new Uint8Array(decoded.length);
                for (let index = 0; index < decoded.length; index += 1)
                    bytes[index] = decoded.charCodeAt(index);
                return {
                    bytes,
                    size: value.size,
                    truncated: value.truncated,
                    ...(typeof value.version === 'string' ? { version: value.version } : {}),
                    ...(typeof value.mediaType === 'string' ? { mediaType: value.mediaType } : {}),
                };
            }
            return legacyHost.readBinary?.(entry);
        },
        async writeText(entry, content, expectedVersion) {
            if (opaqueRefsAvailable) {
                return callOpaque('fs.writeV2', { ref: entry.id, content, expectedVersion });
            }
            return legacyHost.writeText?.(entry, content, expectedVersion) ?? { status: 'rejected', reason: 'file is read-only' };
        },
        treeV2: {
            capability: FILE_TREE_PROJECTION_CAPABILITY_V2,
            async roots(request = {}) {
                try {
                    const value = await callOpaque('fs.treePageV2', { ...(request.cursor === undefined ? {} : { cursor: request.cursor }), ...(request.limit === undefined ? {} : { limit: request.limit }) });
                    const page = parseTreePage(value);
                    opaqueRefsAvailable = true;
                    ownerCapabilities = new Set(page.ownerCapabilities ?? []);
                    return page;
                }
                catch (error) {
                    // owner 切换取消（AbortError）必须穿透：不得吞成 legacy 回退再发请求。
                    if (error instanceof DOMException && error.name === 'AbortError')
                        throw error;
                    opaqueRefsAvailable = false;
                    return legacyTreePage(await legacyHost.listEntries());
                }
            },
            async listChildren(parentRef, request = {}) {
                try {
                    const value = await callOpaque('fs.treePageV2', { parentRef, ...(request.cursor === undefined ? {} : { cursor: request.cursor }), ...(request.limit === undefined ? {} : { limit: request.limit }) });
                    const page = parseTreePage(value);
                    opaqueRefsAvailable = true;
                    ownerCapabilities = new Set(page.ownerCapabilities ?? []);
                    return page;
                }
                catch (error) {
                    if (error instanceof DOMException && error.name === 'AbortError')
                        throw error;
                    opaqueRefsAvailable = false;
                    return legacyTreePage(await legacyHost.listEntries(parentRef), parentRef);
                }
            },
            async search(request) {
                const value = await callOpaque('fs.treePageV2', { query: request.query, ...(request.cursor === undefined ? {} : { cursor: request.cursor }), ...(request.limit === undefined ? {} : { limit: request.limit }) });
                return parseTreePage(value);
            },
            async reveal(ref) {
                const value = await callOpaque('fs.revealV2', { ref });
                return parseReveal(value);
            },
        },
        inspect: {
            capability: FILE_INSPECT_CAPABILITY,
            async inspect(ref) {
                const reveal = revealTokens.get(ref);
                const value = await callOpaque('fs.inspectV2', { ref, ...(reveal === undefined ? {} : { revealToken: reveal.token }) });
                return parseInspect(value);
            },
            async reveal(ref, version) {
                const value = await callOpaque('fs.sensitiveRevealV1', { ref, version });
                if (typeof value.token !== 'string' || typeof value.expiresAt !== 'string')
                    throw new Error('invalid sensitive reveal response');
                revealTokens.set(ref, { version, token: value.token });
                return { token: value.token, expiresAt: value.expiresAt };
            },
        },
        mutations: {
            capability: FILE_RESOURCE_MUTATION_CAPABILITY_V1,
            get enabled() { return opaqueRefsAvailable && ownerCapabilities.has(FILE_RESOURCE_MUTATION_CAPABILITY_V1); },
            get disabledReason() { return this.enabled ? undefined : 'owner mutation capability has not been negotiated'; },
            preflight: intent => callOpaque('fs.mutation.preflightV1', { intent }),
            execute: (proposalRef, intent) => callOpaque('fs.mutation.executeV1', { proposalRef, intent }),
            reconcile: idempotencyKey => callOpaque('fs.mutation.reconcileV1', { idempotencyKey }),
            undo: receiptRef => callOpaque('fs.mutation.undoV1', { receiptRef }),
        },
        transfer: {
            capability: FILE_TRANSFER_CAPABILITY_V1,
            get enabled() { return opaqueRefsAvailable && ownerCapabilities.has(FILE_TRANSFER_CAPABILITY_V1); },
            get disabledReason() { return this.enabled ? undefined : 'owner transfer capability has not been negotiated'; },
            createUpload: input => callOpaque('fs.upload.createV1', { input }),
            async uploadChunk(sessionRef, offset, chunk, digest) {
                const sessionId = options.sessionId?.();
                if (sessionId === undefined || sessionId === '')
                    throw new Error('file transfer requires a session owner');
                const query = new URLSearchParams({ sessionId, sessionRef, offset: String(offset), ...(digest === undefined ? {} : { digest }) });
                const response = await fetchFn(`/yeisme-files/api/fs.upload.chunkV1?${query.toString()}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(chunk) });
                const parsed = await response.json();
                if (parsed.ok !== true || typeof parsed.value?.received !== 'number' || typeof parsed.value.complete !== 'boolean')
                    throw new Error(parsed.error?.message ?? 'invalid upload chunk response');
                return { received: parsed.value.received, complete: parsed.value.complete };
            },
            cancelUpload: sessionRef => callOpaque('fs.upload.cancelV1', { sessionRef }).then(() => undefined),
            commitUpload: sessionRef => callOpaque('fs.upload.commitV1', { sessionRef }),
            issueDownloadTicket: (ref, version) => callOpaque('fs.download.ticketV1', { ref, version }),
            async download(ticket) {
                const sessionId = options.sessionId?.();
                if (sessionId === undefined || sessionId === '')
                    throw new Error('file transfer requires a session owner');
                const response = await fetchFn('/yeisme-files/api/fs.download.consumeV1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, ticket }) });
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                return new Uint8Array(await response.arrayBuffer());
            },
        },
    };
    return opaqueHost;
}
function parseTreePage(value) {
    const parsed = validateFileTreePageV2(value);
    if (!parsed.ok)
        throw new Error(`invalid file tree page: ${parsed.reason}`);
    return parsed.value;
}
function legacyTreePage(entries, parentRef) {
    return {
        workspaceRef: 'workspace:legacy', generation: 'legacy', revision: 'legacy', truncated: false, loaded: entries.length, total: entries.length,
        nodes: entries.map(entry => ({ ref: entry.id, ...(parentRef === undefined ? {} : { parentRef }), name: entry.name, kind: entry.kind === 'directory' ? 'directory' : 'file', version: 'legacy', hasChildren: entry.kind === 'directory', hidden: false, ignored: false, sensitive: false, availability: { inspect: { state: 'unavailable', reason: 'legacy owner has no inspect proof' }, preview: { state: 'unavailable', reason: 'legacy owner has no inspect proof' }, download: { state: entry.capabilities.includes('download') ? 'available' : 'unavailable' }, mutate: { state: 'disabled', reason: 'legacy owner has no mutation capability' } }, freshness: 'contract_mismatch' })),
    };
}
function parseReveal(value) {
    if (typeof value !== 'object' || value === null)
        throw new Error('invalid file reveal');
    const candidate = value;
    if (typeof candidate.workspaceRef !== 'string' || typeof candidate.generation !== 'string' || typeof candidate.revision !== 'string' || !Array.isArray(candidate.breadcrumbs))
        throw new Error('invalid file reveal');
    return candidate;
}
function parseInspect(value) {
    if (typeof value !== 'object' || value === null)
        throw new Error('invalid file inspect proof');
    const candidate = value;
    if (typeof candidate.owner !== 'string' || typeof candidate.ref !== 'string' || typeof candidate.version !== 'string' || typeof candidate.usable !== 'boolean')
        throw new Error('invalid file inspect proof');
    return candidate;
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
        capabilities: [
            'GitTypedActionsCapabilityV1',
            'GitStatusWindowCapabilityV1',
            'GitDiffWindowCapabilityV2',
            'GitMutationActionsCapabilityV2',
            'GitHistoryWindowCapabilityV1',
            'GitCompareSessionCapabilityV1',
        ],
        status: async () => call('git.status'),
        diff: async (path) => call('git.diff', { path }),
        stage: async (path) => call('git.stage', { path }),
        unstage: async (path) => call('git.unstage', { path }),
        commit: async (message) => call('git.commit', { message }),
        statusWindow: {
            capability: 'GitStatusWindowCapabilityV1',
            repositories: async () => call('git.repositories'),
            snapshot: async (request) => call('git.statusWindow', { ...request }),
        },
        diffWindowV2: {
            capability: 'GitDiffWindowCapabilityV2',
            window: async (request) => call('git.diffWindowV2', { ...request }),
        },
        mutationActionsV2: {
            capability: 'GitMutationActionsCapabilityV2',
            actions: ['stage.all', 'unstage.all', 'discard.preflight', 'discard.execute', 'discard.undo', 'commit.preflight', 'commit.execute'],
            preflight: async (intent) => call('git.mutation.preflight', { intent }),
            execute: async (intent) => call('git.mutation.execute', { intent }),
            reconcile: async (idempotencyKey) => call('git.mutation.reconcile', { idempotencyKey }),
        },
        historyWindow: {
            capability: 'GitHistoryWindowCapabilityV1',
            window: async (request) => call('git.historyWindow', { ...request }),
        },
        compareSession: {
            capability: 'GitCompareSessionCapabilityV1',
            create: async (input) => call('git.compareSession', { input }),
        },
    };
}
