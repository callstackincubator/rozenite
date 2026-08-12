---
'@rozenite/chrome-extension': patch
---

Automate building, signing, and publishing the Chrome extension as part of the release pipeline. On stable and rc releases, the extension's `manifest.json` version is now kept in sync with the package version, and CI signs a `.crx` (using a key stored as a GitHub Actions secret) and attaches it to the created GitHub Release.
