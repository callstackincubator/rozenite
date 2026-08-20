// Stands in for Rozenite code leaking into a release bundle. It lives under
// `packages/`, so `isRozeniteModule` classifies it exactly like a real
// workspace module would be -- without this package depending on one.
//
// Deliberately mentions no package name: the polyfill test asserts that a
// leak like this is invisible to a plain text search of the bundle.
module.exports = {
  leaked: true,
};
