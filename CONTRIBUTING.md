# Contributing to Rozenite

## Before you start any work

Please open an issue before starting to work on a new feature or a fix for a bug you encountered. This will prevent you from wasting your time on a feature that's not going to be merged, because for instance it's out of scope. If there is an existing issue present for the matter you want to work on, make sure to post a comment saying you are going to work on it. This will make sure there will be only one person working on a given issue.

## Development process

All development is done directly on GitHub, and all work is public. Contributors send pull requests which go through the review process.

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github).

1. Fork the repo and create your branch from default branch (usually `main`) (a guide on [how to fork a repository](https://help.github.com/articles/fork-a-repo/)).
2. Run `pnpm install` to install & set up the development environment.
3. Run `pnpm build:all` to build all packages.
4. Do the changes you want and test them out in the playground app (`apps/playground`) before sending a pull request.

This repository uses Turborepo to maintain the monorepository and Changesets for version plans.

### Testing your changes

You'll find a playground app in the 'apps' directory. You can use it to easily test your changes, without the need to link the project to your custom app living outside of the monorepository. See [README.md](/apps/playground/README.md) file for additional details on the app itself.

You should also run the following checks before opening a pull request:

1. linting via `pnpm lint:all`
2. formatting via `pnpm format:all`
3. typechecking via `pnpm typecheck:all`

All checks are also run in CI, but by running them locally you can quickly fix any outstanding issues.

### Creating a pull request

When you are ready to have your changes incorporated into the main codebase, open a pull request.

This repository follows [the Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/#summary). Please follow this pattern in your pull requests. Keep in mind your commits will be squashed before merging and the title will be used as a commit title, so the pull request title should match this convention. Generally, if you cannot describe your changes by a single type of commit (your pull request not only adds a new feature, but also refactors another one), consider splitting your pull request into two. As for scopes, use package name, for instance `feat(redux-devtools): add some new feature`.

Make sure to keep an eye out for any necessary updates to the documentation. If you add a new feature, you'll probably need to mention it in the documentation and describe what it is and how to use it. It's less common for fixes, but sometimes needed as well.

This project uses GitHub Actions to run validation checks on your pull requests. Keep an eye out for any failures and fix them promptly.

Before submitting a pull request, you can check if your changes require version plans:

```bash
pnpm release:plan
```

This command analyzes your changes and ensures that appropriate version plan files exist for projects that have been modified. CI will run this check automatically and fail if version plans are missing for relevant changes.

## Release process

Currently, releases are published by maintainers when they determine it's time to do so. Usually, there is at least one release per week as long as there are changes waiting to be published.

## Working on plugins

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
   ROZENITE_DEV_MODE=my-plugin-name pnpm start:playground
   ```
3. **Test your plugin**: Your plugin will be loaded in development mode and you can test it in the DevTools interface.

For more detailed information about plugin development, see the [Plugin Development Guide](https://rozenite.dev/docs/plugin-development/plugin-development).

## Working on documentation

The documentation is a part of the website, which is stored in the `website` directory and uses `rspress` - an SSG framework that leverages `rspack`. To start working on the docs, run `pnpm run dev` from inside the `website` directory.

## If you need help

- **Discord**: Join our [Discord community](https://discord.gg/xgGt7KAjxv)
- **Issues**: Create an issue on GitHub for bugs or feature requests
- **Email**: Contact us at [hello@callstack.com](mailto:hello@callstack.com)

## Resources

- [Documentation](https://rozenite.dev)
- [Plugin Development Guide](https://rozenite.dev/docs/guides/plugin-development)

## License

By contributing to Rozenite, you agree that your contributions will be licensed under its **MIT** license.
