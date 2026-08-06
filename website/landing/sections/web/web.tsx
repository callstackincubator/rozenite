import { Browser, Globe, PuzzlePiece, Stack, type Icon } from '@phosphor-icons/react';

import { ActionButton } from '../../components/action-button/action-button';
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
    label: 'Select a browser target',
    body: 'Open your web app in a supported browser, then select that target in React Native DevTools.',
  },
  {
    icon: Stack,
    label: 'Use Metro or Webpack',
    body: 'Use the matching withRozeniteWeb wrapper: Metro can bundle native and web, while Webpack Dev Server can serve the web app.',
  },
  {
    icon: PuzzlePiece,
    label: 'Install the extension and package',
    body: 'Install the Rozenite browser extension and load @rozenite/web from the web entry point. It runs only in development.',
  },
];

export const Web = () => (
  <Section id="web" tint="subtle" bordered>
    <div className={styles.layout}>
      <div className={styles.copy}>
        <SectionHeader
          eyebrow="Rozenite for Web"
          title="Debug React Native web in DevTools"
          body="Use supported Rozenite panels with browser targets from your React Native web app."
          className={styles.header}
        />

        <Reveal>
          <div className={styles.details}>
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
        </Reveal>
      </div>

      <Reveal className={styles.diagramReveal}>
        <ConnectionDiagram
          from={{
            mark: <Globe size={40} />,
            label: 'React Native Web / Expo Web',
          }}
          to={{
            mark: <img src="/logo.svg" alt="Rozenite" width={40} height={40} />,
            label: 'Rozenite / React Native DevTools',
          }}
          animated={false}
          className={styles.diagram}
        />
      </Reveal>
    </div>
  </Section>
);
