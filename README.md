# Neon Pilot Extensions

This repository contains first-party optional Neon Pilot extensions. Neon Pilot itself keeps core small and ships bundled system extensions from the app repo; optional workflows live here and are distributed as prebuilt `.neon-extension.zip` release artifacts.

## Repository contract

A Neon Pilot extension repository has a root `neon.extensions.json` file. It can point to one extension or many:

```json
{
  "schemaVersion": 1,
  "publisher": {
    "id": "example",
    "name": "Example Publisher"
  },
  "repository": {
    "type": "github",
    "owner": "example",
    "repo": "example-neon-extensions"
  },
  "packages": [
    {
      "id": "example-search",
      "path": "extensions/example-search",
      "channel": "stable"
    }
  ]
}
```

Each package path must contain an `extension.json`. Runtime installs use built artifacts, not npm packages and not install-time compilation.

## Package format

The portable package format is a zip named `<extension-id>-<version>.neon-extension.zip` or `<extension-id>.neon-extension.zip`. The zip must contain exactly one top-level directory:

```text
example-search/
  extension.json
  README.md
  LICENSE
  dist/
    frontend.js
    backend.mjs
  assets/
```

Rules:

- Include `extension.json`.
- Set `"packageType": "user"` for repo-distributed packages so Neon Pilot can uninstall and update them after install.
- Include prebuilt `dist/` entries for every frontend or backend entry.
- Do not include `node_modules`, local build caches, `.dist.tmp-*`, or sidecar build output such as `sidecar/target`.
- Do not rely on npm install, postinstall scripts, or runtime compilation.
- Keep host imports external: `@neon-pilot/extensions`, `@neon-pilot/extensions/ui`, React, and approved backend subpaths are provided by Neon Pilot.
- Declare Neon Pilot compatibility in the extension manifest.

## UI design system

Extension frontends should use Neon Pilot's shared UI SDK:

```tsx
import { Field, Notice, Pill, ProgressBar, SurfacePanel, TextInput, ToolbarButton } from '@neon-pilot/extensions/ui';
```

Do not copy local versions of foundation controls such as fields, inputs, selects, pills, notices, progress bars, option rows, panels, or toolbar buttons. If a reusable control is missing, add it to `packages/ui` in the app repo first, document it in `docs/design-system.md`, then consume it here through `@neon-pilot/extensions/ui`.

Example compatibility metadata:

```json
{
  "schemaVersion": 2,
  "id": "example-search",
  "name": "Example Search",
  "version": "0.1.0",
  "compatibility": {
    "neonPilot": ">=0.10.0",
    "extensionApi": "^2"
  }
}
```

## GitHub distribution

Normal users should install from GitHub release artifacts:

1. Create or update `neon.extensions.json`.
2. Build each extension with Neon Pilot's extension builder.
3. Pack each extension as `<extension-id>.neon-extension.zip`.
4. Publish a GitHub release whose tag matches the Neon Pilot app version that should install those artifacts.
5. Include `neon-extension-catalog.json` with checksums and source metadata.

GitHub is the transport and identity layer. Neon Pilot installs immutable release artifacts; source branch installs are for development only.

The Neon Pilot installer currently resolves catalog items to release assets named:

```text
https://github.com/{owner}/{repo}/releases/download/{tag}/{extension-id}.neon-extension.zip
```

If a package entry does not declare its own `version` or `tag`, Neon Pilot uses the installed app version tag, such as `v0.9.1-rc.6`.

## Development install

For local development, clone this repo beside `neon-pilot` and use the app repo's builder:

```bash
cd ../neon-pilot-extensions
pnpm run build -- --extension system-browser
pnpm run pack -- --extension system-browser --out-dir /tmp/neon-extension-artifacts
```

Then import the zip from Settings -> Extensions, or install a local dev copy into a state root while iterating.

If your Neon Pilot checkout is not beside this repo, set `NEON_PILOT_REPO`:

```bash
NEON_PILOT_REPO=/path/to/neon-pilot pnpm run build -- --extension system-browser
```

## Release workflow

GitHub Actions can publish all packages automatically. Use **Actions -> Publish extension packages -> Run workflow**, enter the Neon Pilot app tag, and leave `neon_pilot_ref` blank to build against the same tag in `patleeman/neon-pilot`.

Pushing a `v*` tag in this repository also runs the workflow. The workflow:

1. Checks out this repository.
2. Checks out `patleeman/neon-pilot` at the selected app tag/ref.
3. Installs Neon Pilot dependencies.
4. Builds and packs every package in `neon.extensions.json`.
5. Uploads all `.neon-extension.zip` assets plus `neon-extension-catalog.json` to the GitHub release.

Prepare all release assets for a Neon Pilot app tag:

```bash
pnpm run release:prepare -- --tag v0.9.1-rc.6
```

Prepare one package:

```bash
pnpm run release:prepare -- --tag v0.9.1-rc.6 --extension system-browser
```

This writes:

```text
release-artifacts/v0.9.1-rc.6/
  system-browser.neon-extension.zip
  ...
  neon-extension-catalog.json
```

Publish the release assets:

```bash
gh release create v0.9.1-rc.6 \
  release-artifacts/v0.9.1-rc.6/*.neon-extension.zip \
  release-artifacts/v0.9.1-rc.6/neon-extension-catalog.json \
  --repo patleeman/neon-pilot-extensions
```

For an existing release, upload replacement assets explicitly:

```bash
gh release upload v0.9.1-rc.6 \
  release-artifacts/v0.9.1-rc.6/*.neon-extension.zip \
  release-artifacts/v0.9.1-rc.6/neon-extension-catalog.json \
  --repo patleeman/neon-pilot-extensions \
  --clobber
```

## First-party packages

- `system-agent-browser` - agent-browser CLI tool integration for autonomous browser/app automation.
- `system-alleycat` - mobile pairing bridge for Kitty Litter clients.
- `system-browser` - browser automation tool and Workbench browser views.
- `system-ds4` - local DeepSeek V4 Flash provider/profile for antirez/ds4.
- `system-duckduckgo-search` - agent web search tool backed by DuckDuckGo HTML results.
- `system-exa-search` - agent tool for Exa web search.
- `system-hermes-agent` - connect Neon Pilot to one or more Hermes Agent API deployments.
- `system-knowledge` - knowledge files, sync, prompt references, and conversation-adjacent knowledge views.
- `system-local-models` - local MLX and GGUF model management UI.
- `system-self-preservation` - agent self-preservation instruction and context hooks.
- `system-suggested-context` - related conversation suggestions for new prompts.
- `system-video-probe` - analyze UI recordings and videos with a video-capable model.
- `system-writing-studio` - writing workflow surface.
