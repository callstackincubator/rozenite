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
    label: 'Read what actually happened',
    body: 'Console output, network captures from a real flow, React profiles and memory snapshots, taken from the running app.',
  },
  {
    icon: PlugsConnected,
    label: 'Call the tools your plugins expose',
    body: 'Agent-enabled plugins register their own tools. Storage, navigation, Redux and TanStack Query become callable in the same session.',
  },
  {
    icon: BracketsCurly,
    label: 'Call the tools your app exposes',
    body: 'Register tools from the app itself when the thing an agent needs is specific to your product, not to a library.',
  },
];

const CLI_SAMPLE = `npx rozenite agent session create

npx rozenite agent console call --tool getMessages --args '{"levels":["error"]}'`;

export const Agents = () => (
  <Section id="agents" tint="block">
    <div className={styles.top}>
      <div className={styles.headerCol}>
        <SectionHeader
          eyebrow="Rozenite for Agents"
          title="Your agent stops guessing at runtime"
          body="Coding agents read code well and runtime badly. Rozenite opens a session against the running app and hands over what it finds there as callable tools."
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
