/**
 * Node-only workspace explorer listing.
 *
 * Adapted from the MIT-licensed DSH-better-sidebar `fs.tree` / `fs.read`
 * host contract: one-level `opendir`, directories first, symlink target
 * probe, and a bounded text read. Paths stay on this host half.
 *
 * @module @yeisme/dsh-file-host/node
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { opendir, open, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
const execFileAsync = promisify(execFile);
const DEFAULT_LIST_LIMIT = 1000;
const DEFAULT_READ_LIMIT = 256 * 1024;
const SYMLINK_PROBE_CONCURRENCY = 32;
export class YeismeFilesError extends Error {
    code;
    status;
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
export function requireAbsolute(path) {
    if (!isAbsolute(path)) {
        throw new YeismeFilesError('fs-error', `"${path}" is not an absolute path`, 400);
    }
    return resolve(path);
}
export function isWithin(base, target, platform = process.platform) {
    const norm = (value) => value.replace(/[\\/]+/g, '/').replace(/\/$/, '');
    const b = norm(base);
    const t = norm(target);
    if (platform === 'win32') {
        const lb = b.toLowerCase();
        const lt = t.toLowerCase();
        return lt === lb || lt.startsWith(`${lb}/`);
    }
    return t === b || t.startsWith(`${b}/`);
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
function compareEntries(left, right) {
    if (left.isDir !== right.isDir)
        return left.isDir ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}
async function probeSymlinkTargets(rows) {
    let next = 0;
    const workers = Array.from({ length: Math.min(SYMLINK_PROBE_CONCURRENCY, rows.length) }, async () => {
        for (;;) {
            const index = next;
            next += 1;
            if (index >= rows.length)
                return;
            const row = rows[index];
            if (row.isSymlink !== true)
                continue;
            const info = await stat(row.path).catch(() => undefined);
            row.isDir = info !== undefined ? info.isDirectory() : row.isDir;
            row.broken = info === undefined;
        }
    });
    await Promise.all(workers);
}
/** List one directory level, files and directories, directories first. */
export async function listWorkspaceTree(path, maxEntries = DEFAULT_LIST_LIMIT) {
    const target = requireAbsolute(path);
    let level;
    try {
        level = await opendir(target);
    }
    catch (error) {
        throw new YeismeFilesError('fs-error', `cannot list "${target}": ${messageOf(error)}`, 400);
    }
    const rows = [];
    let overflow = 0;
    try {
        for await (const dirent of level) {
            if (rows.length >= maxEntries) {
                overflow += 1;
                continue;
            }
            rows.push({
                name: dirent.name,
                path: join(target, dirent.name),
                isDir: dirent.isDirectory(),
                isSymlink: dirent.isSymbolicLink(),
                broken: false,
                hidden: dirent.name.startsWith('.'),
            });
        }
    }
    catch (error) {
        throw new YeismeFilesError('fs-error', `cannot list "${target}": ${messageOf(error)}`, 400);
    }
    await probeSymlinkTargets(rows);
    rows.sort(compareEntries);
    return { path: target, entries: rows, truncated: overflow > 0 };
}
/** Bounded UTF-8 read. Binary files return empty content with binary=true. */
export async function readWorkspaceText(path, readLimit = DEFAULT_READ_LIMIT) {
    const target = requireAbsolute(path);
    const info = await stat(target).catch((error) => {
        throw new YeismeFilesError('fs-error', `cannot read "${target}": ${messageOf(error)}`, 400);
    });
    if (info.isDirectory()) {
        throw new YeismeFilesError('fs-error', `"${target}" is a directory`, 400);
    }
    const truncated = info.size > readLimit;
    const handle = await open(target, 'r').catch((error) => {
        throw new YeismeFilesError('fs-error', `cannot read "${target}": ${messageOf(error)}`, 400);
    });
    try {
        const buffer = Buffer.alloc(Math.min(info.size, readLimit));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        const slice = buffer.subarray(0, bytesRead);
        const binary = slice.includes(0);
        return { content: binary ? '' : slice.toString('utf8'), truncated, binary };
    }
    finally {
        await handle.close();
    }
}
export function rootLabel(path) {
    const base = basename(path);
    return base !== '' ? base : path;
}
export function parentOf(path) {
    const parent = dirname(path);
    return parent === path ? undefined : parent;
}
function parsePorcelain(stdout) {
    const lines = stdout.split('\n').filter(line => line.length > 0);
    let branch = 'HEAD';
    const files = [];
    for (const line of lines) {
        if (line.startsWith('## ')) {
            branch = line.slice(3).split('...')[0] ?? 'HEAD';
            continue;
        }
        files.push({
            index: line.slice(0, 1),
            worktree: line.slice(1, 2),
            path: line.slice(3),
        });
    }
    return { branch, files };
}
function gitExecOptions(cwd) {
    return { cwd, timeout: 8_000, maxBuffer: 256 * 1024 };
}
async function runGit(cwd, args) {
    const target = requireAbsolute(cwd);
    try {
        const { stdout } = await execFileAsync('git', [...args], gitExecOptions(target));
        return stdout;
    }
    catch (error) {
        throw new YeismeFilesError('fs-error', `git ${args[0] ?? 'command'} failed: ${messageOf(error)}`, 400);
    }
}
function requireWorkspaceRelativePath(cwd, path) {
    if (path.length === 0 || path.length > 400) {
        throw new YeismeFilesError('bad-request', 'invalid git path', 400);
    }
    if (path.startsWith('/') || path.includes('\0') || path.includes('..') || /[\r\n]/.test(path)) {
        throw new YeismeFilesError('forbidden', 'git path escapes the session workspace', 403);
    }
    const target = resolve(cwd, path);
    if (!isWithin(cwd, target)) {
        throw new YeismeFilesError('forbidden', 'git path escapes the session workspace', 403);
    }
    return path;
}
/** Read-only `git status --porcelain=v1 -b` inside the session workspace. */
export async function readGitStatus(cwd) {
    const stdout = await runGit(cwd, ['status', '--porcelain=v1', '-b']);
    return parsePorcelain(stdout);
}
const DIFF_LIMIT = 64 * 1024;
/** Bounded `git diff -- path` inside the session workspace. */
export async function readGitDiff(cwd, path) {
    const relative = requireWorkspaceRelativePath(cwd, path);
    const stdout = await runGit(cwd, ['diff', '--', relative]);
    const truncated = stdout.length > DIFF_LIMIT;
    return { path: relative, patch: truncated ? stdout.slice(0, DIFF_LIMIT) : stdout, truncated };
}
/** Typed `git add -- path`. */
export async function gitStage(cwd, path) {
    const relative = requireWorkspaceRelativePath(cwd, path);
    await runGit(cwd, ['add', '--', relative]);
    return { status: 'ok', actionId: 'stage' };
}
/** Typed `git restore --staged -- path`. */
export async function gitUnstage(cwd, path) {
    const relative = requireWorkspaceRelativePath(cwd, path);
    await runGit(cwd, ['restore', '--staged', '--', relative]);
    return { status: 'ok', actionId: 'unstage' };
}
/** Typed `git commit -m message`. Timeout is not treated as success. */
export async function gitCommit(cwd, message) {
    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > 400) {
        throw new YeismeFilesError('bad-request', 'commit message is required and must be at most 400 characters', 400);
    }
    if (/[\r\n]/.test(trimmed)) {
        throw new YeismeFilesError('bad-request', 'commit message must be a single line', 400);
    }
    await runGit(cwd, ['commit', '-m', trimmed]);
    return { status: 'ok', actionId: 'commit' };
}
const MAX_BODY_BYTES = 1 << 20;
async function readJsonBody(req) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const buffer = Buffer.from(chunk);
        total += buffer.length;
        if (total > MAX_BODY_BYTES)
            throw new YeismeFilesError('bad-request', 'request body too large');
        chunks.push(buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.trim() === '')
        return {};
    try {
        return JSON.parse(text);
    }
    catch {
        throw new YeismeFilesError('bad-request', 'request body is not valid JSON');
    }
}
function writeJson(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}
function requireString(payload, key) {
    const record = payload;
    const value = record?.[key];
    if (typeof value !== 'string' || value === '') {
        throw new YeismeFilesError('bad-request', `missing or invalid "${key}"`);
    }
    return value;
}
/**
 * POST /yeisme-files/api/fs.tree and /yeisme-files/api/fs.read.
 * Same JSON envelope as the community sidebar API, different prefix.
 */
export async function handleYeismeFilesApi(req, res, options) {
    if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
        return;
    }
    const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname;
    const method = pathname.startsWith('/yeisme-files/api/') ? pathname.slice('/yeisme-files/api/'.length) : undefined;
    if (method === undefined || method.includes('/')) {
        writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'unknown files API method' } });
        return;
    }
    try {
        const payload = await readJsonBody(req);
        const record = payload;
        const sessionId = typeof record.sessionId === 'string' ? record.sessionId : undefined;
        const clientCwd = typeof record.cwd === 'string' && record.cwd !== '' ? record.cwd : undefined;
        const cwd = requireAbsolute(options.sessionCwd(sessionId, clientCwd));
        if (method === 'fs.tree') {
            const target = record.path === undefined || record.path === '' ? cwd : requireAbsolute(requireString(payload, 'path'));
            if (!isWithin(cwd, target))
                throw new YeismeFilesError('forbidden', 'path escapes the session workspace', 403);
            writeJson(res, 200, { ok: true, value: await listWorkspaceTree(target) });
            return;
        }
        if (method === 'fs.read') {
            const target = requireAbsolute(requireString(payload, 'path'));
            if (!isWithin(cwd, target))
                throw new YeismeFilesError('forbidden', 'path escapes the session workspace', 403);
            writeJson(res, 200, { ok: true, value: await readWorkspaceText(target) });
            return;
        }
        if (method === 'git.status') {
            writeJson(res, 200, { ok: true, value: await readGitStatus(cwd) });
            return;
        }
        if (method === 'git.diff') {
            writeJson(res, 200, { ok: true, value: await readGitDiff(cwd, requireString(payload, 'path')) });
            return;
        }
        if (method === 'git.stage') {
            writeJson(res, 200, { ok: true, value: await gitStage(cwd, requireString(payload, 'path')) });
            return;
        }
        if (method === 'git.unstage') {
            writeJson(res, 200, { ok: true, value: await gitUnstage(cwd, requireString(payload, 'path')) });
            return;
        }
        if (method === 'git.commit') {
            writeJson(res, 200, { ok: true, value: await gitCommit(cwd, requireString(payload, 'message')) });
            return;
        }
        writeJson(res, 404, { ok: false, error: { code: 'not-found', message: `unknown files API method "${method}"` } });
    }
    catch (error) {
        if (error instanceof YeismeFilesError) {
            writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
            return;
        }
        writeJson(res, 500, { ok: false, error: { code: 'internal', message: messageOf(error) } });
    }
}
