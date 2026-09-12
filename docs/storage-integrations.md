# Storage integration plan

The first release is issue #15: persistent, read-only local source folders.
This preserves the browser-only application and fixes repeated per-file
relinking when browser folder permission persists. Cloud integrations are
separate follow-up work; none are enabled by this change.

## 1. Make local folders the default

Use Connect folder → scan → import, with a single Reconnect folder action per
root. Keep temporary imports for unsupported browsers. Explain that browser
permission may expire and that clearing site data removes saved connections.
Test actual native-handle persistence across browser restarts, permission
revocation, moved roots, backup restoration, and browser profiles before release.
Unit tests use mock permission/traversal handles and cloneable storage stand-ins.

As the lowest-setup option, document selecting an already synced Google Drive,
Dropbox, OneDrive, or network-mounted folder. Users should make dataset files
available offline in their existing sync client. This requires no new account,
API keys, or cloud permissions in the workbench. Test each sync client's
placeholder/download behavior rather than promising every mounted file is local.

Chrome documents handle persistence in IndexedDB and user-controlled persistent
permissions: https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api

## 2. Define a shared connection contract

Keep annotations and project backups separate from audio access. Extend source
connections with provider kind, display name, provider folder ID, and connection
status. Tasks refer to a stable connection ID plus provider file ID and revision;
retain relative paths for display, export, and local recovery. Remote providers
should use their stable file IDs so renames need not break annotations.

Adapters need connect, list/paginate, inspect permission, resolve, reconnect,
and disconnect operations. Centralize abortable downloads, bounded memory use,
object-URL cleanup, expired credentials, offline states, missing files, and
changed-file detection. Require explicit replacement for a changed recording;
do not silently reuse existing timestamps against different audio.

Backups include portable IDs and revisions, never OAuth credentials, expiring
URLs, native handles, or audio. Cloud mode is opt-in and clearly describes that
selected audio is downloaded from the provider for local processing.

## 3. Pilot Dropbox, then Google Drive

Target setup: Connect account → sign in → choose dataset folder → preview →
import. The application owner registers and configures the OAuth application;
end users should never create developer projects or paste API keys.

Dropbox is the first proposed pilot for recursive dataset folders. Request only
metadata/content read scopes, paginate listing, persist file IDs/revisions, and
reconnect at account/folder level. Prove team/shared-folder behavior separately.
Dropbox recommends PKCE with short-lived tokens and no refresh tokens for a
pure JavaScript client: https://developers.dropbox.com/oauth-guide

For durable sign-in, add an optional small backend that manages refresh tokens,
uses secure HTTP-only sessions, and supports revocation. Keep audio downloads
direct from the provider where supported. Browser-only deployments retain local
folders; a token-expiry prompt should never become per-file relinking. Validate
provider CORS, large files, rate limits, account disconnection, and token rotation
in the pilot before committing to the backend design.

Google Drive is next. Start with Picker-selected files and the narrow drive.file
scope; prototype recursive existing-folder access before promising it. The
scope is per file, and selecting a folder must not be assumed to grant every
descendant. Broader read scopes have a different verification burden. See:
https://developers.google.com/workspace/drive/api/guides/api-specific-auth

## 4. Add power-user sources only after the pilot

Add OneDrive if users need Microsoft accounts, then S3-compatible object storage
for managed datasets. S3 setup should be an administrator-provided connection
or backend-minted short-lived access, not permanent secret keys pasted into the
browser. Verify provider-specific authentication, CORS, signed URL expiry, and
range-request support during that phase. Defer WebDAV and custom servers until
there is demonstrated demand; their setup and browser compatibility are less
predictable.

Release gates: a nontechnical user connects a dataset without developer setup;
reload/restart and token renewal preserve task identity; nested duplicate names
remain distinct; disconnect and restore never discard annotations; local mode
makes no provider requests. Keep a repeatable manual matrix for real browser
permissions alongside automated adapter, persistence, and restore tests.
