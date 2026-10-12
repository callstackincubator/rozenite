export type InspectPackedPackageOptions = {
  /**
   * Path prefixes (relative to the package root) that legitimately contain
   * files that look development-only, such as the plugin template that
   * `rozenite generate` copies.
   */
  allowDevelopmentFilesUnder?: string[];
  /** Path prefixes whose modules are not scanned for relative imports. Defaults to `['dist/devtools/']`. */
  skipImportCheckUnder?: string[];
};

export type PackedPackage = {
  name: string;
  /** Every file in the tarball, relative to the package root. */
  files: string[];
  /** The `package.json` as published (after `publishConfig` overrides). */
  manifest: Record<string, unknown>;
  /** Human-readable reasons the tarball is wrong. Empty when it is right. */
  problems: string[];
};

export function inspectPackedPackage(
  packageRoot: string,
  options?: InspectPackedPackageOptions,
): PackedPackage;
