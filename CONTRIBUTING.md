# Contributing to Rozenite

## Code of Conduct

We want this community to be friendly and respectful to each other. Please read [the full text](./CODE_OF_CONDUCT.md) so that you can understand what actions will and will not be tolerated.

## Requirements

- Node 20+
- pnpm 9.15.3+

## Our Development Process

All development is done directly on GitHub, and all work is public.

### Development workflow

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github).

1. Fork the repo and create your branch from default branch (usually `main`) (a guide on [how to fork a repository](https://help.github.com/articles/fork-a-repo/)).
2. Run `pnpm install` to install & set up the development environment.
3. Do the changes you want
4. Build plugins with `pnpm build`
5. Test them out with `pnpm start` that uses the playground app (`app/playground`) before sending a pull request.

<br>

> WARNING<br>
> Under pnpm 10+, if you encounter sqlite3 native binding errors, workaround it by removing `withRozeniteReduxDevTools()` in `apps/playground/metro.config.js`

### Commit message convention

We follow the [conventional commits specification](https://www.conventionalcommits.org/en) for our commit messages:

- `fix`: bug fixes, e.g. fix plugin loading issue.
- `feat`: new features, e.g. add new CLI command.
- `refactor`: code refactor, e.g. new folder structure for plugins.
- `docs`: changes into documentation, e.g. add usage example for MMKV plugin.
- `test`: adding or updating tests, e.g. unit, snapshot testing.
- `chore`: tooling changes, e.g. change nx config.
- `BREAKING CHANGE`: for changes that break existing usage, e.g. change API of a plugin.

**Scopes:**

- `cli`, `metro`, `plugin-bridge`, `runtime`, `vite-plugin`
- `expo-atlas-plugin`, `mmkv-plugin`, `network-activity-plugin`, `tanstack-query-plugin`
- `website`, `playground`

### Version Management

When making changes that affect public APIs, behavior, or logic, you need to create a version plan file. You can do this by running:

```bash
pnpm nx release plan
```

This will guide you through creating a version plan file in the `.nx/version-plans/` directory that specifies which projects should receive version bumps and what type of bump they should receive.

For more details, see the [Nx Release Version Plans documentation](https://nx.dev/recipes/nx-release/file-based-versioning-version-plans).

### Linting and tests

We use `typescript` for type checking, `eslint` for linting, `prettier` for formatting, and `jest`/`vitest` for testing. You should run the following commands before sending a pull request:

- `pnpm nx run-many -t typecheck --projects="packages/*"`: type-check files with `tsc`.
- `pnpm nx run-many -t lint --projects="packages/*"`: lint files with `eslint`.
- `pnpm nx run-many -t test --projects="packages/*"`: run unit tests with `jest`/`vitest`.
- `pnpm prettier --check .`: check code formatting.

### Sending a pull request

- Prefer small pull requests focused on one change.
- Verify that `typescript`, `eslint`, `prettier` and all tests are passing.
- Verify all in-code documentation is correct (it will be used to generate API documentation).
- Ensure version plans exist for changes that affect public APIs (this will be checked in CI).
- Follow the pull request template when opening a pull request.

### Version Plan Validation

Before submitting a pull request, you can check if your changes require version plans:

```bash
pnpm nx release plan:check
```

This command analyzes your changes and ensures that appropriate version plan files exist for projects that have been modified. CI will run this check automatically and fail if version plans are missing for relevant changes.

### Running the example

The example PlaygroundApp uses React Native Community CLI so make sure you have your [environment setup to build native apps](https://reactnative.dev/docs/environment-setup).

You can then use Xcode/Android Studio/Gradle to build application or run `pnpm nx start playground` and `pnpm nx run-ios playground`/`pnpm nx run-android playground` to start development server and run applications in development mode.

### Working on plugins

When developing plugins, you can test them in the playground app using development mode. This allows you to load your local plugin without building and publishing it.

1. **Add your plugin to the workspace**: Since this project uses pnpm workspaces, you can add your plugin as a workspace dependency in the playground app's `package.json`:
   ```json
   {
     "dependencies": {
       "my-plugin": "workspace:*"
     }
   }
   ```
2. **Set development mode**: Set the `ROZENITE_DEV_MODE` environment variable to your plugin name:
   ```bash
   ROZENITE_DEV_MODE=my-plugin-name pnpm nx start playground
   ```
3. **Test your plugin**: Your plugin will be loaded in development mode and you can test it in the DevTools interface

For more detailed information about plugin development, see the [Plugin Development Guide](https://rozenite.dev/docs/plugin-development/plugin-development).

### Working on documentation

The documentation is a part of the website, which is stored in `website` directory and uses `rspress` - an SSG framework that leverages `rspack`. To start working on the docs, either run `pnpm run dev` from inside of the `website` directory.

## Reporting issues

You can report issues on our [bug tracker](https://github.com/callstackincubator/rozenite/issues). Please follow the issue template when opening an issue.

## Need Help?

### Getting Help

- **Discord**: Join our [Discord community](https://discord.gg/xgGt7KAjxv)
- **Issues**: Create an issue on GitHub for bugs or feature requests
- **Email**: Contact us at [hello@callstack.com](mailto:hello@callstack.com)

### Resources

- [Documentation](https://rozenite.dev)
- [Plugin Development Guide](https://rozenite.dev/docs/guides/plugin-development)

## License

By contributing to Rozenite, you agree that your contributions will be licensed under its **MIT** license.

---

**Made with ❤️ at [Callstack](https://callstack.com)**
