#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const dshHome = process.argv[2]
const transcriptPath = process.argv[3]
if (typeof dshHome !== 'string' || dshHome === '') {
  process.stderr.write('personal-coding-pty-boot: missing DSH_HOME\n')
  process.exit(2)
}

const script = join(tmpdir(), `dsh-personal-pty-${process.pid}.py`)
writeFileSync(script, `import os, pty, re, select, sys, time, json, signal
home = sys.argv[1]
transcript_path = sys.argv[2] if len(sys.argv) > 2 else ''
os.environ['DSH_HOME'] = home
os.environ['TERM'] = 'xterm-256color'
pid, fd = pty.fork()
if pid == 0:
    os.execvp('dsh', ['dsh', '--profile', 'tui', '--debug-tui', '--viewport', '80x24', '--no-mouse'])
deadline = time.time() + 10
buf = b''
ready_seen = False
while time.time() < deadline:
    ready, _, _ = select.select([fd], [], [], 0.2)
    if fd in ready:
        try:
            chunk = os.read(fd, 8192)
        except OSError:
            break
        if not chunk:
            break
        buf += chunk
        if b'ready when you are' in buf and not ready_seen:
            ready_seen = True
            extra = time.time() + 1.5
            while time.time() < extra:
                ready, _, _ = select.select([fd], [], [], 0.2)
                if fd not in ready:
                    continue
                try:
                    chunk = os.read(fd, 8192)
                except OSError:
                    extra = 0
                    break
                if not chunk:
                    extra = 0
                    break
                buf += chunk
            break
# Two-step exit: Esc out of composer, then q twice. Do not SIGTERM first.
try:
    os.write(fd, b'\\x1b')
    time.sleep(0.25)
    os.write(fd, b'q')
    time.sleep(0.4)
    os.write(fd, b'q')
except OSError:
    pass
end = time.time() + 3
while time.time() < end:
    ready, _, _ = select.select([fd], [], [], 0.2)
    if fd in ready:
        try:
            chunk = os.read(fd, 8192)
        except OSError:
            break
        if not chunk:
            break
        buf += chunk
status = None
for _ in range(15):
    try:
        waited, st = os.waitpid(pid, os.WNOHANG)
        if waited == pid:
            status = st
            break
    except ChildProcessError:
        status = 0
        break
    time.sleep(0.2)
forced_term = False
if status is None:
    forced_term = True
    try:
        os.kill(pid, signal.SIGTERM)
        _, status = os.waitpid(pid, 0)
    except (OSError, ChildProcessError):
        status = -1
try:
    os.close(fd)
except OSError:
    pass
text = buf.decode('utf-8', 'replace')
plain = re.sub(r'\\x1b\\[[0-9;]*[A-Za-z]', '', text).replace('\\r', '')
if transcript_path:
    os.makedirs(os.path.dirname(transcript_path) or '.', exist_ok=True)
    with open(transcript_path, 'w', encoding='utf-8') as handle:
        handle.write(plain)
debug = None
match = re.search(r'debug log: (/[A-Za-z0-9_./-]+)', plain)
if match:
    debug = match.group(1)
elif 'debug log:' in plain:
    debug = 'present'
exited = os.WIFEXITED(status) if isinstance(status, int) and status >= 0 else False
signaled = os.WIFSIGNALED(status) if isinstance(status, int) and status >= 0 else False
exitcode = os.WEXITSTATUS(status) if exited else None
termsig = os.WTERMSIG(status) if signaled else None
plugin_tree = any(token in plain for token in (
    'plugin tree failed',
    'did not activate',
    'ERR_MODULE_NOT_FOUND',
    'Cannot find package',
    'Cannot find module',
    'duplicate loader entry id',
))
clean_wait = (exited and exitcode == 0) or (signaled and termsig == signal.SIGTERM and not forced_term)
result = {
    'ready': 'ready when you are' in plain and 'DSH' in plain,
    'module_not_found': 'ERR_MODULE_NOT_FOUND' in plain or 'Cannot find package' in plain or 'Cannot find module' in plain,
    'duplicate_loader': 'duplicate loader entry id' in plain,
    'plugin_tree_failed': plugin_tree,
    'debug_log': debug,
    'bytes': len(buf),
    'wait_status': status,
    'exitcode': exitcode,
    'termsig': termsig,
    'forced_term': forced_term,
    'clean_wait': clean_wait,
}
print(json.dumps(result))
ok = result['ready'] and not plugin_tree and clean_wait and isinstance(debug, str) and debug != ''
sys.exit(0 if ok else 1)
`)

if (typeof transcriptPath === 'string' && transcriptPath !== '') mkdirSync(dirname(transcriptPath), { recursive: true })
const result = spawnSync('python3', [script, dshHome, transcriptPath ?? ''], {
  encoding: 'utf8',
  env: { ...process.env, DSH_HOME: dshHome, TERM: 'xterm-256color' },
  maxBuffer: 8 * 1024 * 1024,
})
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
process.exit(result.status ?? 1)
