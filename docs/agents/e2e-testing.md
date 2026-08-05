# End-to-end testing

- E2E testing is available through `apps/playground`.
- Use E2E testing for changes likely to break behavior and for visual changes that cannot be adequately tested otherwise.
- Define the E2E cases before testing.
- Spawn a `gpt-5.6-luna` or `haiku` sub-agent to run the cases.
- Pass the sub-agent all instructions in this guide and all change-specific context.
- Prefer the iPhone simulator; test Android only when crucial.
- Verify that Rozenite is installed on the running simulator.
- If Rozenite is installed, assume it is up to date.
- For unusual issues, assume the app is outdated and rebuild from `apps/playground`:

  ```bash
  pnpm expo run:ios
  pnpm expo run:android
  ```

- After package or dependency changes, rebuild with Turborepo, for example:

  ```bash
  pnpm turbo run build
  ```

- Refresh the browser after rebuilding.
- With the Playground app and Metro running, query Metro's `/json/list` endpoint.
- Extract the inspector URL from the response.
- Replace the `ws` query parameter in this URL with the extracted inspector URL:

  ```text
  http://127.0.0.1:8081/rozenite/rn_fusebox.html?ws=%2Finspector%2Fdebug%3Fdevice%3D2ce2ba5f071e81a9efad6f66a9e029fd6aa11ccd%26page%3D1&sources.hide_add_folder=true&unstable_enableNetworkPanel=true&appId=com.callstackcincubator.rozenite
  ```

- Open the resulting URL with `agent-browser`.
- In React Native DevTools, open the Rozenite tab, select the plugin from the sidebar, and run the E2E cases.
