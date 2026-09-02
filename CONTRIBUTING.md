# Contributing

Run changes from the repository root with pnpm 10 and a supported Node.js
version.

```powershell
pnpm install --frozen-lockfile
pnpm format
pnpm validate
```

Keep framework-independent domain behavior under `web/src/domain`, all
IndexedDB access under `web/src/storage`, and browser UI under
`web/src/features` or `web/src/components`. Database versions describe physical
store/index migrations; persisted entity versions and portable format versions
are separate compatibility contracts.

Do not commit source audio, browser file handles, absolute local paths, generated
build output, or private dataset content. Tests should use small synthetic
fixtures. Use `fake-indexeddb` for storage tests and preserve transactional
rollback coverage for multi-store changes.
