import { DeviceMobile, SquaresFour, type Icon } from '@phosphor-icons/react';

import { ActionButton } from '../../components/action-button/action-button';
import { CodeSample } from '../../components/code-sample/code-sample';
import { CommandLine } from '../../components/command-line/command-line';
import { Reveal } from '../../components/reveal/reveal';
import { Section, SectionHeader } from '../../components/section/section';
import styles from './build-your-own.module.css';

const HALVES: { icon: Icon; title: string; body: string }[] = [
  {
    icon: DeviceMobile,
    title: 'The app side',
    body: 'Runs inside your app with access to React Native APIs and anything you already depend on.',
  },
  {
    icon: SquaresFour,
    title: 'The DevTools UI side',
    body: 'React components mounted as DevTools tabs, wired to the app side over a typed event bridge.',
  },
];

const PLUGIN_SAMPLE = `const client = useRozeniteDevToolsClient<EventMap>({
  pluginId: 'checkout-inspector',
});

client.onMessage('cart-updated', (cart) => {
  setItems(cart.items);
});

client.send('clear-cart', { reason: 'devtools' });`;

export const BuildYourOwn = () => (
  <Section id="build" tint="subtle">
    <SectionHeader
      title="The panel you need does not exist yet"
      body="Feature flags for one checkout flow. A window into your own sync engine. A bridge to internal observability. Rozenite gives you the transport, the build setup and the DevTools slot, so a plugin is a panel and a message map instead of a project."
    />

    <Reveal>
      <div className={styles.halves}>
        {HALVES.map((half) => {
          const Glyph = half.icon;

          return (
            <div className={styles.half} key={half.title}>
              <Glyph className={styles.halfIcon} size={22} />
              <h3 className={styles.halfTitle}>{half.title}</h3>
              <p className={styles.halfBody}>{half.body}</p>
            </div>
          );
        })}
      </div>

      <div className={styles.bottom}>
        <CodeSample title="panel.tsx" meta="typescript" code={PLUGIN_SAMPLE} />

        <div className={styles.aside}>
          <h3 className={styles.asideTitle}>Scaffold one in two commands</h3>

          <div className={styles.commands}>
            <CommandLine command="npx rozenite generate my-plugin" />
            <CommandLine command="cd my-plugin && rozenite dev" />
          </div>

          <div className={styles.actions}>
            <ActionButton
              href="/docs/plugin-development/overview"
              variant="outline"
            >
              Plugin development guide
            </ActionButton>
          </div>
        </div>
      </div>
    </Reveal>
  </Section>
);
