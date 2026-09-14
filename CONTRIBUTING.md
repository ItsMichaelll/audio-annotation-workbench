# Contributing

These instructions apply to the owner and to contributors who have received
prior written permission to modify the project. The proprietary license does not
grant the public a general right to modify or redistribute the source.

Use Node.js `^20.19.0` or `>=22.12.0` and the pnpm version declared in the root
package. Install from the repository root without changing the lockfile:

```powershell
corepack enable
pnpm install --frozen-lockfile
```

Keep framework-independent domain behavior under `web/src/domain`, all
IndexedDB access under `web/src/storage`, routed UI under `web/src/features`, and
shared UI under `web/src/components`. Database versions describe physical store
and index migrations. Persisted entity, taxonomy, backup, and export versions are
separate compatibility contracts.

Before review, run:

```powershell
pnpm validate
git diff --check
```

The validation command checks Prettier, ESLint, Stylelint, TypeScript, Vitest,
and the production build. It also formats maintained Markdown outside `web/`.
Keep commands portable across Windows, macOS, and CI.

Tests should use small synthetic audio and data fixtures. Use `fake-indexeddb`
for storage tests and retain rollback coverage for multi-store changes. Changes
to a portable format or persisted entity require explicit compatibility and
migration decisions.

Do not commit source audio, private dataset content, browser handles, absolute
local paths, generated build output, local databases, or credentials. Do not
commit, tag, publish, or push a release without the owner's approval.

See [Development and releases](docs/releasing.md) for setup, upgrade guidance,
and the release checklist.
