/**
 * Tests for the /session hub action menu.
 *
 * Actions gate on owner capabilities: missing actions stay visible with a
 * reason, keyboard navigation follows the shared keymap, and the archived
 * variant swaps Archive for Restore.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import type { SessionHubAction, SessionHubActionItem } from '@yeisme/dsh-client-ui-command-experience-core';
import { SessionActionMenu } from '../src/session-hub';

const FULL_CAPABILITIES = new Set([
  'open-session',
  'rename-session',
  'archive-session',
  'restore-session',
]);

function renderMenu(options: {
  availableActions?: ReadonlySet<string>;
  archived?: boolean;
  onSelectAction?: (action: SessionHubAction, item: SessionHubActionItem) => void;
} = {}) {
  const onSelectAction = options.onSelectAction ?? vi.fn();
  const view = render(React.createElement(SessionActionMenu, {
    targetLabel: 'Alpha draft',
    availableActions: options.availableActions ?? FULL_CAPABILITIES,
    archived: options.archived ?? false,
    onSelectAction,
    onClose: vi.fn(),
  }));
  return { view, onSelectAction };
}

describe('SessionActionMenu', () => {
  it('lists switch, rename, and archive for an active session', () => {
    renderMenu();
    expect(screen.getByRole('menuitem', { name: /switch to this session/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /rename this session/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /archive this session/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /restore/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('swaps archive for restore on archived targets', () => {
    renderMenu({ archived: true });
    expect(screen.queryByRole('menuitem', { name: /archive this session/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /restore this archived session/i })).toBeInTheDocument();
  });

  it('keeps missing owner actions visible but disabled with a reason', () => {
    renderMenu({ availableActions: new Set(['open-session']) });
    const rename = screen.getByRole('menuitem', { name: /rename this session/i });
    expect(rename).toBeDisabled();
    const archive = screen.getByRole('menuitem', { name: /archive this session/i });
    expect(archive).toBeDisabled();
  });

  it('navigates with arrows and executes the highlighted action', async () => {
    const user = userEvent.setup();
    const onSelectAction = vi.fn();
    renderMenu({ onSelectAction });

    const dialog = screen.getByRole('dialog', { name: /session actions for alpha draft/i });
    dialog.focus();

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onSelectAction).toHaveBeenCalledTimes(1);
    expect(onSelectAction.mock.calls[0]?.[0]).toBe('rename');
  });

  it('refuses to execute a disabled action', async () => {
    const user = userEvent.setup();
    const onSelectAction = vi.fn();
    renderMenu({
      availableActions: new Set(['open-session']),
      onSelectAction,
    });

    const dialog = screen.getByRole('dialog', { name: /session actions for alpha draft/i });
    dialog.focus();

    // Navigate to the disabled rename row and try to run it.
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onSelectAction).not.toHaveBeenCalled();
  });

  it('jumps to the last action with End', async () => {
    const user = userEvent.setup();
    const onSelectAction = vi.fn();
    renderMenu({ onSelectAction });

    const dialog = screen.getByRole('dialog', { name: /session actions for alpha draft/i });
    dialog.focus();

    await user.keyboard('{End}');
    await user.keyboard('{Enter}');
    expect(onSelectAction.mock.calls[0]?.[0]).toBe('archive');
  });
});
