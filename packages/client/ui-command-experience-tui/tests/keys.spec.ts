/**
 * TUI terminal key parsing tests.
 *
 * Synthetic key sequences drive the shared keymap through the local
 * console controller. No stdin, no rawMode: the official host feeds keys
 * through the contribution seam and stays fail-closed until it ships.
 */

import { describe, expect, it } from 'vitest';
import { applyTuiConsoleKey, isToggleFromIdle, parseTerminalKey } from '../src/keys';
import { createConsoleController, splitSessionHubInput } from '../src/client';
import { TUI_COMMAND_CATALOG } from './fixtures';

describe('parseTerminalKey', () => {
  it('maps arrow, home, and end escape sequences', () => {
    expect(parseTerminalKey('\x1b[A')).toMatchObject({ key: 'arrowup' });
    expect(parseTerminalKey('\x1b[B')).toMatchObject({ key: 'arrowdown' });
    expect(parseTerminalKey('\x1b[H')).toMatchObject({ key: 'home' });
    expect(parseTerminalKey('\x1b[F')).toMatchObject({ key: 'end' });
    expect(parseTerminalKey('\x1b[1~')).toMatchObject({ key: 'home' });
    expect(parseTerminalKey('\x1b[4~')).toMatchObject({ key: 'end' });
  });

  it('maps control keys and plain characters', () => {
    expect(parseTerminalKey('\r')).toMatchObject({ key: 'enter' });
    expect(parseTerminalKey('\t')).toMatchObject({ key: 'tab' });
    expect(parseTerminalKey('\x1b')).toMatchObject({ key: 'escape' });
    expect(parseTerminalKey('\x0e')).toMatchObject({ key: 'n', ctrl: true });
    expect(parseTerminalKey('\x10')).toMatchObject({ key: 'p', ctrl: true });
    expect(parseTerminalKey('\x04')).toMatchObject({ key: 'd', ctrl: true });
    expect(parseTerminalKey('\x0b')).toMatchObject({ key: 'k', ctrl: true });
    expect(parseTerminalKey('A')).toMatchObject({ key: 'a', ctrl: false });
  });

  it('returns null for empty or unknown sequences', () => {
    expect(parseTerminalKey('')).toBeNull();
    expect(parseTerminalKey('\x1b[999z')).toBeNull();
  });
});

describe('applyTuiConsoleKey', () => {
  it('opens nothing from idle and reports toggle for ctrl+k', () => {
    const controller = createConsoleController();
    const resolution = applyTuiConsoleKey({
      controller,
      sequence: '\x0b',
      commands: TUI_COMMAND_CATALOG,
    });
    expect(resolution.kind).toBe('toggle');
    expect(controller.getState().state).toBe('idle');
    expect(isToggleFromIdle('\x0b')).toBe(true);
    expect(isToggleFromIdle('k')).toBe(false);
  });

  it('moves the cursor and completes with tab in the assist console', () => {
    const controller = createConsoleController();
    controller.dispatch({ type: 'START_ASSIST', query: '/res', draft: '/res' });

    const candidateKeys = ['cmd:resume', 'cmd:session'];
    const down = applyTuiConsoleKey({
      controller,
      sequence: '\x1b[B',
      commands: TUI_COMMAND_CATALOG,
      candidateKeys,
    });
    expect(down.kind).toBe('action');
    expect(controller.getState().cursorKey).toBe('cmd:resume');

    const enter = applyTuiConsoleKey({
      controller,
      sequence: '\r',
      commands: TUI_COMMAND_CATALOG,
      candidateKeys,
    });
    expect(enter.kind).toBe('execute-cursor');
  });

  it('cancels an open palette with escape and restores the draft', () => {
    const controller = createConsoleController();
    controller.dispatch({ type: 'START_ASSIST', query: '/', draft: '/res' });

    const resolution = applyTuiConsoleKey({
      controller,
      sequence: '\x1b',
      commands: TUI_COMMAND_CATALOG,
    });
    expect(resolution.kind).toBe('action');
    expect(controller.getState().state).toBe('idle');
    expect(controller.getState().draft).toBe('/res');
  });

  it('treats ctrl+k as close when the palette is open', () => {
    const controller = createConsoleController();
    controller.dispatch({ type: 'START_ASSIST', query: '/', draft: '/' });

    const resolution = applyTuiConsoleKey({
      controller,
      sequence: '\x0b',
      commands: TUI_COMMAND_CATALOG,
    });
    expect(resolution.kind).toBe('toggle');
    expect(controller.getState().state).toBe('idle');
  });

  it('feeds the shared keymap through controller.handleKeyEvent', () => {
    const controller = createConsoleController();
    controller.dispatch({ type: 'START_ASSIST', query: '/', draft: '/' });

    const resolution = controller.handleKeyEvent('\x1b[B', {
      commands: TUI_COMMAND_CATALOG,
      candidateKeys: ['cmd:resume'],
    });
    expect(resolution.kind).toBe('action');
    expect(controller.getState().cursorKey).toBe('cmd:resume');
  });
});

describe('splitSessionHubInput', () => {
  it('splits /session subcommands and keeps the alias working', () => {
    expect(splitSessionHubInput('/session')).toEqual({
      assistInput: '/session',
      subcommand: { kind: 'switch' },
    });
    expect(splitSessionHubInput('/session archive')).toEqual({
      assistInput: '/session',
      subcommand: { kind: 'archive' },
    });
    expect(splitSessionHubInput('/sessions rename New title')).toEqual({
      assistInput: '/sessions',
      subcommand: { kind: 'rename', title: 'New title' },
    });
    expect(splitSessionHubInput(':session restore')).toEqual({
      assistInput: '/session',
      subcommand: { kind: 'restore' },
    });
  });

  it('returns null for other commands', () => {
    expect(splitSessionHubInput('/resume')).toBeNull();
    expect(splitSessionHubInput('/agent')).toBeNull();
    expect(splitSessionHubInput('plain text')).toBeNull();
  });
});
