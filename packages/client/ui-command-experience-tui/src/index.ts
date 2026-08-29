/**
 * DSH TUI Command Experience
 *
 * Thin console adapter over the shared command directory and reducer.
 * Registers through a public TUI contribution seam and fails closed when
 * that seam is missing. No host patching, no fake console, no RPC on
 * first discovery.
 */

export type {
  CommandConsoleContribution,
  CommandConsoleContributionHost,
  CommandConsoleRegistration,
  CommandExperienceTuiAdapter,
  LocalCommandConsoleHost,
  TuiAssistController,
  TuiAssistPrefix,
  TuiAssistResolution,
  TuiCommandExperienceCapabilityProbe,
  TuiConsoleKeyInput,
  TuiSelectorKind,
} from './client';

export {
  COLON_MIGRATION_HINT,
  OFFICIAL_TUI_CONSOLE_PACKAGE,
  applyCommandExperienceTui,
  applyTuiAssist,
  applyTuiConsoleKey,
  isToggleFromIdle,
  commandExperienceTuiAdapter,
  createCommandConsoleContribution,
  createConsoleController,
  createLocalCommandConsoleHost,
  getCommandDisabledReason,
  inspectCommandConsoleHost,
  isColonAssistInput,
  normalizeTuiAssistInput,
  parseTerminalKey,
  probeTuiCommandExperienceCapabilities,
  registerCommandConsoleContribution,
  resolveTuiAssistQuery,
  selectorKindFor,
} from './client';

export { splitSessionHubInput } from './assist';
