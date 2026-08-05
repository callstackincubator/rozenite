import {
  BracketsCurly,
  PlugsConnected,
  Terminal,
  type Icon,
} from '@phosphor-icons/react';

import { ActionButton } from '../../components/action-button/action-button';
import { CodeSample } from '../../components/code-sample/code-sample';
import { Reveal } from '../../components/reveal/reveal';
import { Section, SectionHeader } from '../../components/section/section';
import styles from './agents.module.css';

type Capability = {
  icon: Icon;
  label: string;
  body: string;
};

const CAPABILITIES: Capability[] = [
  {
    icon: Terminal,
    label: 'Inspect runtime data',
    body: 'Read console logs, network requests, React profiles, and memory snapshots from the selected app session.',
  },
  {
    icon: PlugsConnected,
    label: 'Use plugin tools',
    body: 'Plugins can register agent tools. Storage, React Navigation, Redux, and TanStack Query expose tools when their integration is enabled.',
  },
  {
    icon: BracketsCurly,
    label: 'Add app-specific tools',
    body: 'Register tools for product-specific state or actions that do not belong to a library plugin.',
  },
];

const CLI_SAMPLE = `npx rozenite agent session create

npx rozenite agent console call \\
  --tool getMessages \\
  --args '{"levels":["error"]}' \\
  --session <session-id>`;

export const Agents = () => (
  <Section id="agents">
    <div className={styles.top}>
      <div className={styles.headerCol}>
        <SectionHeader
          eyebrow="Rozenite for Agents"
          title="Give your agent access to the running app"
          body="Rozenite creates a session for the running app. An agent can inspect its runtime domains and call registered app or plugin tools."
          className={styles.header}
        />

        <ActionButton href="/docs/agent/overview" variant="outline">
          Agent documentation
        </ActionButton>
      </div>

      <Reveal>
        <CodeSample
          title="terminal"
          meta="rozenite agent"
          code={CLI_SAMPLE}
          language="shell"
          className={styles.sample}
        />
      </Reveal>
    </div>

    <Reveal>
      <div className={styles.capabilities}>
        {CAPABILITIES.map((capability) => {
          const Glyph = capability.icon;

          return (
            <div className={styles.capability} key={capability.label}>
              <Glyph className={styles.capabilityIcon} size={22} />
              <h3 className={styles.capabilityLabel}>{capability.label}</h3>
              <p className={styles.capabilityBody}>{capability.body}</p>
            </div>
          );
        })}
      </div>
    </Reveal>
  </Section>
);
