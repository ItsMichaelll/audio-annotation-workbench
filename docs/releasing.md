# Development and releases

Audio Annotation Workbench 0.1.0 is distributed as a repository clone and runs
from a local Vite server. The packages remain private and are not published to
npm.

## Development setup

Use Node.js `^20.19.0` or `>=22.12.0`; Node 22 is the release CI version. Corepack
must activate the exact pnpm `10.33.0` version declared in `package.json`.

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The default URL is [http://127.0.0.1:5173](http://127.0.0.1:5173). The server binds to loopback and
fails when port 5173 is already occupied. Intentional LAN testing can use
`pnpm dev -- --host 0.0.0.0`; do this only on a trusted network.

Run the full local gate before handing off a change:

```powershell
pnpm validate
git diff --check
```

`pnpm validate` checks formatting, TypeScript and CSS linting, types, tests, and
the production build. The GitHub Actions workflow runs the same validation after
a frozen-lockfile install.

## Upgrade a local checkout

Browser data is tied to the exact browser profile and origin. Before changing
versions:

1. Start the currently installed version at the same origin used to create the
   projects.
2. Download a separate backup for every project that must be retained.
3. Keep the original audio folders and files available; backups contain no
   audio or browser permissions.
4. Stop the development server.
5. Fetch the repository and check out the desired release tag or updated branch.
6. Run `corepack enable` and `pnpm install --frozen-lockfile` again.
7. Run `pnpm validate`, then `pnpm dev`.
8. Open the same origin and confirm the projects. Restore the backups if the
   database is unavailable, then reconnect folders or relink individual files.

Data stored at `http://localhost:5173` is separate from the 0.1.0 default at
`http://127.0.0.1:5173`. Before changing origins, an older checkout can be
started deliberately with:

```powershell
pnpm dev -- --host localhost
```

Open [http://localhost:5173](http://localhost:5173), export every required backup, then return to the
default origin and restore those files. Do not clear the older origin's site data
until the restored projects have been checked.

## Release checklist

- [x] Confirm the release branch and review `git status`; preserve any independent
      user changes.
- [x] Confirm root and web package versions, `private: true`, the declared pnpm
      version, and the lockfile.
- [x] Review the README, user guide, data formats, architecture, license, and
      changelog against the current application.
- [x] From a clean checkout, run `pnpm install --frozen-lockfile` and
      `pnpm validate`.
- [x] Confirm GitHub Actions passes on the release pull request.
- [x] Start `pnpm dev`; verify `http://127.0.0.1:5173` and strict failure when the
      port is occupied.
- [x] In the supported Chrome environment, smoke-test project creation, taxonomy
      and instructions editing, every import path, source-folder reconnection,
      relinking, multi-region and marker behavior, autosave, submission, task
      reopening, backup/restore, both export formats, and the standalone editor.
- [x] Review known limitations and ensure no private dataset content, source audio,
      build output, browser handles, or absolute local paths are tracked.
- [ ] Merge the approved release changes into `main` according to repository policy.
- [ ] Create the annotated `v0.1.0` tag from the reviewed merge commit and push the
      tag.
- [ ] Draft the GitHub release from the 0.1.0 changelog entry, review it, and
      publish only after approval.

The tag and release should be created only after the commit hash, validation,
and manual test result are recorded. There is no npm publication step.

## 0.1.0 manual test baseline

The initial release was manually tested with Google Chrome 152.0.7977.83,
Official Build, 64-bit, Stable, on Windows 11. Chromium-based desktop browsers
are the primary target. Other browser and operating-system combinations should
be reported as unverified until they receive their own test pass.

Manual testing should include the temporary import/relink fallback because
persistent directory APIs may be unavailable or permission may expire. A denied
durable-storage request is an expected browser-controlled outcome and does not
remove the need for backups.

Long recordings should be checked with the waveform, spectrogram, and analysis
views that matter to the intended workflow. Performance may begin to degrade
around 30 minutes or longer depending on hardware, codec, sample rate, and
enabled analysis. The application imposes no duration cutoff.
