import type { ReactNode } from 'react';

// Imported before the sections so the tokens and the scoped reset are emitted
// ahead of every component stylesheet.
import './styles/tokens.css';
import styles from './landing-page.module.css';

import { Agents } from './sections/agents/agents';
import { BuildYourOwn } from './sections/build-your-own/build-your-own';
import { Closing } from './sections/closing/closing';
import { Hero } from './sections/hero/hero';
import { Plugins } from './sections/plugins/plugins';
import { Web } from './sections/web/web';

type LandingPageProps = {
  /**
   * Rendered after the last section. The host decides what the page footer is,
   * so the landing page itself stays free of framework-specific chrome.
   */
  footer?: ReactNode;
};

export const LandingPage = ({ footer }: LandingPageProps) => (
  <div className={styles.root} data-rz-landing>
    <main>
      <Hero />
      <Plugins />
      <Agents />
      <Web />
      <BuildYourOwn />
      <Closing />
    </main>
    {footer}
  </div>
);
