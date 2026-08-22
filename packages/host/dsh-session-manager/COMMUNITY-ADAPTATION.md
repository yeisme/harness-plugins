# Community Adaptation Notes

This package is adapted from the MIT-licensed
[dsh-session-manager](https://github.com/dream12347/dsh-session-manager).
The original plugin is not a runtime dependency; the feature surface below is
being re-implemented against DSH official services and safe projection
contracts.

| Community feature | Adapted contract in this package |
| --- | --- |
| Session list / search / workspace grouping | `SessionManagerHostV1.listSessions()` + `SessionSummaryV1` |
| Archive / restore | `archiveSession()` / `restoreSession()` |
| Trash / restore / purge | `trashSession()` / `purgeSession()` |
| Continue / pause | `resumeSession()` / `pauseSession()` |
| New chat from session (fork) | `forkSession()` |
| User labels | `setLabels()` + planned `session/labels` event |
| Unread / running status | `SessionSummaryV1.unread` / `running` |

All mutations return typed `SessionMutationReceiptV1`; the placeholder host
returns `not_implemented` until real DSH services are wired in M1.
