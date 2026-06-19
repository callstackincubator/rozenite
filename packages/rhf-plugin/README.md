![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin for inspecting React Hook Form in React Native DevTools.

The React Hook Form plugin streams live form snapshots to DevTools: field values (including nested paths), errors, dirty and touched flags, submit and validation state, and inferred field types where available.

![React Hook Form Plugin](https://rozenite.dev/rhf-plugin.png)

## Installation

```bash
npm install @rozenite/rhf-plugin
```

Peer dependency:

```bash
npm install react-hook-form
```

`react-hook-form` **^7.33.1** is required alongside `react` and `react-native`.

## Usage

Call `useRozeniteRHFPlugin` in any component that has access to your form `control` (typically next to `useForm`).

```ts
import { useForm } from 'react-hook-form';
import { useRozeniteRHFPlugin } from '@rozenite/rhf-plugin';

type FormValues = {
  email: string;
  profile: { name: string };
};

function SignUpScreen() {
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: '', profile: { name: '' } },
  });

  useRozeniteRHFPlugin({ control });

  return (
    // ...your fields registered with this control
  );
}
```

### Multiple forms

When more than one form is mounted at once, pass a stable `id` so each instance is listed separately in DevTools:

```ts
useRozeniteRHFPlugin({ control, id: 'checkout-shipping' });
```

If you omit `id`, the hook uses React’s `useId()` for a dev-only identifier.

## Web (React Native for Web)

When you use [Rozenite for Web](https://rozenite.dev/docs/rozenite-for-web) in development, this plugin loads in the browser like on native. It follows the same `control` wiring as in your React Native app, as long as `react-hook-form` is available in the bundle.

## Notes

- The hook is **development-only**: in production (`NODE_ENV === 'production'`) and on the server, the exported hook is a no-op.
- Snapshots are deduplicated with deep equality; unchanged form state does not spam the bridge.
- Nested field names (dot paths) are grouped in the DevTools panel for easier scanning.
