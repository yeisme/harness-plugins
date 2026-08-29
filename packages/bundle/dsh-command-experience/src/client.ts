/**
 * DSH Command Experience Client Export
 *
 * Client-side exports for Web/TUI integration.
 * This is loaded via the ModuleLoader system in the browser.
 */

// Re-export core types and utilities for Web/TUI adapters
export * from '@yeisme/dsh-client-ui-command-experience-core';

import { commandExperienceTuiAdapter } from '@yeisme/dsh-client-ui-command-experience-tui';

export { commandExperienceTuiAdapter };

// Web adapter lives in @yeisme/dsh-client-ui-command-experience-web.
// React stays external, so this bundle ships a handoff descriptor, not a
// fake adapter value.
export const commandExperienceWebAdapterRef = {
  packageName: '@yeisme/dsh-client-ui-command-experience-web',
  bundled: false,
  reason: 'React is an external peer dependency; the web adapter ships as its own package',
} as const;

// Module loader registration
if (typeof window !== 'undefined' && (window as any).__ModuleLoader__) {
  (window as any).__ModuleLoader__.load({
    id: '@yeisme/dsh-command-experience',
    factory: (_require: any) => {
      const module = { exports: {} };
      const exports = module.exports;

      // Export the core functionality
      Object.assign(exports, {
        // Core exports will be added here
        commandExperienceWebAdapterRef,
        commandExperienceTuiAdapter,
      });

      return module.exports;
    },
  });
}
