# DSH web pane: terminal and side chat

English | [中文](dsh-web-pane-terminal-sidechat.zh.md)

Two panes that work on published DSH releases today: a line-oriented terminal
console over the official `ctx.terminals` capability, and a side chat that
parallels another session without touching your main conversation.

## Terminal console

Requires DSH **0.1.1-rc.2 or newer** (the release line that ships
`packages/terminal/`). On older releases the console and `/terminal` show an
honest disabled reason instead of a fake terminal.

1. Install the bundle:

   ```
   dsh plugin --profile web add @yeisme/dsh-terminal
   ```

2. Open the console from the pane picker, or type `/terminal`.
3. Pick the **owner session** (defaults to the current one). Terminals you
   create are owned by that session's agent and die with it, exactly like
   agent tool terminals.
4. `New terminal` spawns one via the registered backend (`shell`). The
   scrollback view is bounded; older output beyond the retention bound is
   marked `truncated`.
5. Send a line with `Send` (Enter submits; uncheck the submit box to send raw
   fragments for REPLs). One send runs at a time — the composer locks while a
   send is waiting. A send that never reaches readiness is interrupted at the
   60s cap (`cancelledByWaitTimeout`) so nothing stays stuck.
6. `Interrupt (SIGINT)` signals the foreground process group; `Close terminal`
   closes it and awaits process-tree quiescence.
7. Scrollback refreshes on conversation activity of the owner session (for
   example a terminal tool call finishing). There is no polling.

What this is not: the xterm.js raw-VT view stays gated on the official duplex
seam (`TerminalHostV2`, experience Tier 2). Full-screen apps, resize, and
keystroke-level input are deferred upstream.

## Side chat

Works on current published releases — it only uses official client services.

1. Install the bundle:

   ```
   dsh plugin --profile web add @yeisme/dsh-side-chat
   ```

2. Open it with `/side-chat` (or the pane picker). One tab starts at the
   session picker; you can open several tabs at once.
3. Three ways to fill a tab:
   - **Pick a session** from the list to attach it;
   - **New session** if the runtime exposes `create` (otherwise the button is
     disabled with a pointer to fork);
   - **Fork current** to branch off the main conversation with history.
4. Chat as usual: Enter sends; while the session is running the default is
   steer (switch to queue with the checkbox), `Stop` cancels the turn,
   `Load earlier messages` pages backward.
5. Closing a tab only detaches the local subscription — the session keeps
   running and stays in the list. The **main conversation selection never
   changes**; that invariant is enforced by tests.

## Troubleshooting

- Terminal shows "Terminals are unavailable": your DSH predates the terminals
  capability. Upgrade to ≥ 0.1.1-rc.2.
- Terminal probe reports missing methods (`missing:...`): the terminals
  service exists but drifted from the contract; upgrade the plugin and DSH
  together.
- "New session" disabled in side chat: the runtime does not expose
  `sessions.create`; use fork or attach instead.
- A side chat tab says the session cannot be attached: the session is neither
  listed nor scoped — reopen it in the main area first, then attach.
