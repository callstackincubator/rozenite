import { Browser, PuzzlePiece, Stack, type Icon } from '@phosphor-icons/react';

import { ActionButton } from '../../components/action-button/action-button';
import { BrandMark } from '../../components/brand-mark/brand-mark';
import { CommandLine } from '../../components/command-line/command-line';
import { ConnectionDiagram } from '../../components/connection-diagram/connection-diagram';
import { Reveal } from '../../components/reveal/reveal';
import { Section, SectionHeader } from '../../components/section/section';
import styles from './web.module.css';

type Point = {
  icon: Icon;
  label: string;
  body: string;
};

const POINTS: Point[] = [
  {
    icon: Browser,
    label: 'One set of panels for native and web',
    body: 'The panels you use against a simulator keep working against the browser build.',
  },
  {
    icon: Stack,
    label: 'Metro only, or Webpack for web',
    body: 'Wrap the config with withRozeniteWeb either way. Metro can bundle both platforms, or Webpack Dev Server can serve the web app.',
  },
  {
    icon: PuzzlePiece,
    label: 'Two moving parts',
    body: 'The browser extension, and @rozenite/web in the app. The package gates itself, so the import needs no __DEV__ guard.',
  },
];

export const Web = () => (
  <Section id="web" bordered>
    <SectionHeader
      eyebrow="Rozenite for Web"
      title="Same panels, pointed at web"
      body="React Native web builds usually drop out of the DevTools story and back into browser tabs. This keeps them where everything else is."
    />

    <Reveal>
      <div className={styles.layout}>
        <div className={styles.copy}>
          <ul className={styles.points}>
            {POINTS.map((point) => {
              const Glyph = point.icon;

              return (
                <li className={styles.point} key={point.label}>
                  <Glyph className={styles.pointIcon} size={20} />
                  <span>
                    <span className={styles.pointLabel}>{point.label}</span>
                    <span className={styles.pointBody}>{point.body}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className={styles.setup}>
            <CommandLine command="npm install -D @rozenite/web" />
            <div className={styles.actions}>
              <ActionButton href="/docs/rozenite-for-web" variant="outline">
                Web setup guide
              </ActionButton>
            </div>
          </div>
        </div>

        <ConnectionDiagram
          from={{
            mark: <BrandMark slug="react" label="React Native" size={40} />,
            label: 'Your web build',
            meta: '@rozenite/web',
          }}
          to={{
            mark: (
              <BrandMark slug="googlechrome" label="Google Chrome" size={40} />
            ),
            label: 'Rozenite panels',
            meta: 'browser extension',
          }}
          caption="One session, messages both ways"
        />
      </div>
    </Reveal>
  </Section>
);
