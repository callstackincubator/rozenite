# @rozenite/chrome-extension

## 2.3.0

## 2.2.0

## 2.1.0

### Patch Changes

- [#394](https://github.com/callstackincubator/rozenite/pull/394) [`eabe827`](https://github.com/callstackincubator/rozenite/commit/eabe82763b1db1c0bb42c4fd29aadb066da6f67a) Thanks [@V3RON](https://github.com/V3RON)! - Automate building, signing, and publishing the Chrome extension as part of the release pipeline. On stable and rc releases, the extension's `manifest.json` version is now kept in sync with the package version, and CI signs a `.crx` (using a key stored as a GitHub Actions secret) and attaches it to the created GitHub Release.

## 2.0.0

## 1.13.0

## 1.12.0

## 1.11.0

## 1.10.0

## 1.9.0

## 1.8.1

## 1.8.0

## 1.7.0

## 1.6.0

## 1.5.1

## 1.5.0

## 1.4.0

## 1.3.0

### Minor Changes

- Introduce Rozenite for Web — the option to run Rozenite in React Native projects targeting web. Use the Rozenite Chrome extension and @rozenite/web package to debug web apps from React Native DevTools. Documentation covers setup, supported plugins, and making custom plugins compatible with web.
