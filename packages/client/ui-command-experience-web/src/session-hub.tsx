/**
 * /session hub action menu.
 *
 * Adapter-owned second stage after a session pick: lists the hub actions
 * for the picked target with shared keymap navigation. Actions whose owner
 * capability is missing stay visible but disabled with a reason. The hub
 * never offers delete; archive routes through the danger gates upstream.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, type MenuItem } from '@deepseek-ai/dsh-client-ui-primitives';
import { Surface } from '@yeisme/dsh-client-ui-surface';
import type {
  CommandReducerState,
  SessionHubAction,
  SessionHubActionItem,
} from '@yeisme/dsh-client-ui-command-experience-core';
import {
  buildSessionHubActions,
  createInitialState,
  resolveKeyAction,
  resolveKeymap,
} from '@yeisme/dsh-client-ui-command-experience-core';
import type { CommandKeyboardShortcuts } from './types';
import { commandKeyEventFromDom } from './hooks';

export interface SessionActionMenuProps {
  /** Label of the picked session target */
  readonly targetLabel: string;
  /** Owner capability snapshot used to gate hub actions */
  readonly availableActions: ReadonlySet<string>;
  /** Whether the picked target is archived (shows Restore instead of Archive) */
  readonly archived?: boolean;
  /** Called when an enabled action is chosen */
  readonly onSelectAction: (action: SessionHubAction, item: SessionHubActionItem) => void;
  /** Called when the menu is dismissed */
  readonly onClose?: () => void;
  /** Custom keyboard shortcuts for the action list */
  readonly keyboardShortcuts?: CommandKeyboardShortcuts;
}

export const SessionActionMenu: React.FC<SessionActionMenuProps> = ({
  targetLabel,
  availableActions,
  archived = false,
  onSelectAction,
  onClose,
  keyboardShortcuts,
}) => {
  const items = useMemo(
    () => buildSessionHubActions({ availableActions, archived }),
    [availableActions, archived],
  );
  const keymap = useMemo(() => resolveKeymap(keyboardShortcuts), [keyboardShortcuts]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedIdx >= items.length) {
      setSelectedIdx(0);
    }
  }, [items.length, selectedIdx]);

  const choose = useCallback((item: SessionHubActionItem) => {
    if (item.disabled) {
      return;
    }
    onSelectAction(item.action, item);
  }, [onSelectAction]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const selectorState: CommandReducerState = { ...createInitialState(), state: 'selector' };
    const resolution = resolveKeyAction({
      event: commandKeyEventFromDom(event.nativeEvent),
      state: selectorState,
      config: keymap,
      context: { candidateKeys: items.map((item) => item.action), commands: [] },
    });

    if (resolution.kind === 'action') {
      const action = resolution.action;
      if (action.type === 'MOVE_SELECTION') {
        event.preventDefault();
        if (action.index !== undefined) {
          setSelectedIdx(Math.max(0, Math.min(action.index, items.length - 1)));
        } else {
          setSelectedIdx((current) =>
            Math.max(0, Math.min(current + (action.delta ?? 0), items.length - 1)));
        }
        return;
      }
      if (action.type === 'CANCEL') {
        event.preventDefault();
        onClose?.();
      }
      return;
    }

    if (resolution.kind === 'execute-cursor') {
      event.preventDefault();
      const item = items[selectedIdx];
      if (item) {
        choose(item);
      }
    }
  }, [keymap, items, selectedIdx, choose, onClose]);

  const menuItems = useMemo<readonly MenuItem[]>(() => items.map(item => ({
    id: item.action,
    disabled: item.disabled,
    label: <span className="session-action-label">
      {item.label}
      {item.reason && <span className="session-action-reason" aria-label={`Disabled: ${item.reason}`}>{item.reason}</span>}
    </span>,
  })), [items]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      tabIndex={0}
      className="session-action-menu"
      aria-modal="true"
      aria-label={`Session actions for ${targetLabel}`}
      onKeyDown={handleKeyDown}
    >
      <Surface kind="micro">
      <Menu
        open
        anchor={<span className="session-action-target">{targetLabel}</span>}
        items={menuItems}
        selectedId={items[selectedIdx]?.action}
        onSelect={(id) => {
          const index = items.findIndex(item => item.action === id);
          if (index >= 0) {
            setSelectedIdx(index);
            choose(items[index]!);
          }
        }}
        onClose={() => onClose?.()}
        compact
      />
      <div className="session-action-announcer" role="status" aria-live="polite">
        {items[selectedIdx]?.label ?? ''}
      </div>
      </Surface>
    </div>
  );
};
