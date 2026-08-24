import { describe, expect, it } from 'vitest';
import {
  commandStableKey,
  projectBoundedWindow,
  retainSelectionAnchor,
  selectorStableKey,
} from '../src/index';

describe('bounded projection', () => {
  it('uses stable command and selector keys', () => {
    expect(commandStableKey('Resume')).toBe('cmd:resume');
    expect(selectorStableKey('session', 'sess-9')).toBe('session:sess-9');
  });

  it('projects a bounded window around the selected key for large catalogs', () => {
    const items = Array.from({ length: 500 }, (_, index) => ({
      key: commandStableKey(`cmd-${String(index).padStart(3, '0')}`),
    }));
    const selectedKey = commandStableKey('cmd-240');
    const projection = projectBoundedWindow(items, { windowSize: 40, selectedKey });

    expect(projection.virtualized).toBe(true);
    expect(projection.items).toHaveLength(40);
    expect(projection.selectedKey).toBe(selectedKey);
    expect(projection.items.some((item) => item.key === selectedKey)).toBe(true);
    expect(projection.total).toBe(500);
  });

  it('does not jump to a neighbor when the selected key disappears', () => {
    const before = ['session:a', 'session:b', 'session:c'];
    const afterRefresh = ['session:a', 'session:c', 'session:d'];
    const retained = retainSelectionAnchor('session:b', afterRefresh);
    const projection = projectBoundedWindow(
      afterRefresh.map((key) => ({ key })),
      { selectedKey: retained.key, windowSize: 10 },
    );

    expect(retained.key).toBeNull();
    expect(retained.jumpedToNeighbor).toBe(false);
    expect(projection.selectedKey).toBeNull();
    expect(projection.selectedIndex).toBe(-1);
  });

  it('keeps the same key when capability refresh reorders neighbors', () => {
    const refreshed = ['cmd:zeta', 'cmd:alpha', 'cmd:resume', 'cmd:help'];
    const retained = retainSelectionAnchor('cmd:resume', refreshed);
    const projection = projectBoundedWindow(
      refreshed.map((key) => ({ key })),
      { selectedKey: retained.key },
    );

    expect(retained.key).toBe('cmd:resume');
    expect(projection.selectedKey).toBe('cmd:resume');
    expect(projection.selectedIndex).toBe(2);
  });
});
