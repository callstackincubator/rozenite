import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolvePackagePathFromVirtualPath, isPnP } from '../pnp.js';

describe('isPnP', () => {
  describe('when the project is a Yarn Plug\'n\'Play project', () => {
    beforeAll(() => {
      process.versions.pnp = '3';
    });

    afterAll(() => {
      delete process.versions.pnp;
    })

    it('should return true', () => {
      expect(isPnP()).toBe(true);
    });
  });

  describe('when the project is not a Yarn Plug\'n\'Play project', () => {
    beforeAll(() => {
      delete process.versions.pnp;
    });

    it('should return false', () => {
      expect(isPnP()).toBe(false);
    });
  });
});

describe('resolvePackagePathFromVirtualPath', () => {
  describe('when the virtual path is provided', () => {
    const SCOPED_PACKAGE_VIRTUAL_PATH = '/path/to/project/.yarn/__virtual__/some-rozenite-plugin-virtual-39bf83846a/0/cache/@rozenite-tanstack-query-plugin-npm-1.2.0-723ced2ce3-a6b5bf6f06.zip/node_modules/@rozenite/tanstack-query-plugin/dist/react-native.cjs';
    const NON_SCOPED_PACKAGE_VIRTUAL_PATH = '/path/to/project/.yarn/__virtual__/some-rozenite-plugin-virtual-39bf83846a/0/cache/some-rozenite-plugin-npm-1.2.0-723ced2ce3-a6b5bf6f06.zip/node_modules/some-rozenite-plugin/index.js';

    it('should return the package name', () => {
      const scoped = resolvePackagePathFromVirtualPath(SCOPED_PACKAGE_VIRTUAL_PATH);
      const nonScoped = resolvePackagePathFromVirtualPath(NON_SCOPED_PACKAGE_VIRTUAL_PATH);

      expect(scoped.basePath).toBe(
        '/path/to/project/.yarn/__virtual__/some-rozenite-plugin-virtual-39bf83846a/0/cache/@rozenite-tanstack-query-plugin-npm-1.2.0-723ced2ce3-a6b5bf6f06.zip/node_modules/@rozenite/tanstack-query-plugin'
      );
      expect(nonScoped.basePath).toBe(
        '/path/to/project/.yarn/__virtual__/some-rozenite-plugin-virtual-39bf83846a/0/cache/some-rozenite-plugin-npm-1.2.0-723ced2ce3-a6b5bf6f06.zip/node_modules/some-rozenite-plugin'
      );

      expect(scoped.packageName).toBe('@rozenite/tanstack-query-plugin');
      expect(nonScoped.packageName).toBe('some-rozenite-plugin');
    });
  });

  describe('when the unplugged virtual path is provided', () => {
    const SCOPED_PACKAGE_UNPLUGGED_PATH = '/path/to/project/.yarn/unplugged/@rozenite-tanstack-query-plugin-virtual-39bf83846a/node_modules/@rozenite/tanstack-query-plugin/dist/react-native.cjs';
    const NON_SCOPED_PACKAGE_UNPLUGGED_PATH = '/path/to/project/.yarn/unplugged/some-rozenite-plugin-virtual-39bf83846a/node_modules/some-rozenite-plugin/dist/some-rozenite-plugin/index.js';

    it('should return the package name', () => {
      const scoped = resolvePackagePathFromVirtualPath(SCOPED_PACKAGE_UNPLUGGED_PATH);
      const nonScoped = resolvePackagePathFromVirtualPath(NON_SCOPED_PACKAGE_UNPLUGGED_PATH);
      
      expect(scoped.basePath).toBe(
        '/path/to/project/.yarn/unplugged/@rozenite-tanstack-query-plugin-virtual-39bf83846a/node_modules/@rozenite/tanstack-query-plugin'
      );
      expect(nonScoped.basePath).toBe(
        '/path/to/project/.yarn/unplugged/some-rozenite-plugin-virtual-39bf83846a/node_modules/some-rozenite-plugin'
      );

      expect(scoped.packageName).toBe('@rozenite/tanstack-query-plugin');
      expect(nonScoped.packageName).toBe('some-rozenite-plugin');
    });
  });
});
