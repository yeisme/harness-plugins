/**
 * DSH Command Experience Client Export
 *
 * Client-side exports for Web/TUI integration.
 * This is loaded via the ModuleLoader system in the browser.
 */

// Re-export core types and utilities for Web/TUI adapters
export * from '@yeisme/dsh-client-ui-command-experience-core';

// Placeholder for Web adapter implementation
// Will be implemented in tasks 4.x (Web) and 5.x (TUI)
export const commandExperienceWebAdapter = null;

export const commandExperienceTuiAdapter = null;

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
        commandExperienceWebAdapter,
        commandExperienceTuiAdapter,
      });

      return module.exports;
    },
  });
}
