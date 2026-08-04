import { HomeFooter } from '@callstack/rspress-theme';

import { LandingPage } from '../landing';

/**
 * Rspress entry point for `/`. This is the only file that knows about Rspress.
 * The page itself lives in `website/landing`, which has no framework imports.
 */
export const frontmatter = {
  pageType: 'custom',
};

export default function Home() {
  return <LandingPage footer={<HomeFooter />} />;
}
