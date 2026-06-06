# Auto Router

Composer control and settings surface for judge-based model routing.

Install this optional extension from **Settings -> Extensions -> Available**. After enabling it, the composer preferences row shows an **Auto** control next to the model and thinking controls. The control persists whether auto routing is enabled for the current profile and displays the configured judge, routing window, switchover mode, tool context mode, and policy text.

## Settings

Settings live under the **Auto Router** extension settings group:

- Enable auto router by default
- Natural-language routing policy
- Judge model, temperature, and max tokens
- Routing window turns and max switches
- Switchover mode
- Tool context mode and head/tail truncation limits
- Promotion approval behavior
- Preferred frontend/design and promoted models

Tool context modes are deterministic. The extension does not spend an LLM call summarizing tool output.

## Runtime Boundary

This package intentionally owns the installable UX surface. Transcript-aware judge invocation and automatic model switching require a host-level conversation routing API so user extensions can observe routing windows, receive deterministic tool records, and request approval notices without importing desktop internals.

Until that API exists, this extension is the installable control/settings layer rather than the full routing engine.

## Build

From the extension repo root:

```bash
NEON_PILOT_REPO=/Users/patrick/workingdir/neon-pilot pnpm run build -- system-auto-router
```
