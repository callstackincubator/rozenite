/*
 * The one file in `landing/` that reaches outside the website.
 *
 * `@rozenite/ui` exports only its barrel, and declares no `sideEffects: false`,
 * so importing the loader through the package entry point would pull Base UI,
 * TanStack Table, Virtuoso and lucide-react into a static docs bundle for the
 * sake of one canvas. The loader itself depends on nothing but React.
 *
 * The website is never published -- it is only ever bundled -- so it can import
 * the workspace source directly and skip the package's export map entirely.
 * That keeps `@rozenite/ui` unchanged and keeps a single source of truth for
 * the animation.
 *
 * The deep path lives here and nowhere else: sections import from this module,
 * so if the package ever grows a `./rozenite-loader` subpath export, this file
 * is the only one that changes.
 */
export {
  RozeniteLoader,
  type RozeniteLoaderProps,
} from '../../../../packages/ui/src/rozenite-loader/rozenite-loader';
