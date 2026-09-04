import { ActionButton } from '../../components/action-button/action-button';
import { BrandMark } from '../../components/brand-mark/brand-mark';
import { CommandLine } from '../../components/command-line/command-line';
import { Reveal } from '../../components/reveal/reveal';
import { Section, SectionHeader } from '../../components/section/section';
import styles from './lynx.module.css';

type Step = {
  title: string;
  body: string;
};

/**
 * Ordered, because the order is the point: the DevTool switch is off by
 * default and nothing else in the list works until it is on.
 */
const STEPS: Step[] = [
  {
    title: 'Turn on Lynx DevTool',
    body: 'Lynx ships its DevTool component switched off. Flip it on in the app, then relaunch — nothing is discoverable until you do.',
  },
  {
    title: 'Add the plugin',
    body: 'One entry in lynx.config.ts. The plugin injects the device runtime for you, in development only, so there is nothing to import in your app.',
  },
  {
    title: 'Open the printed URL',
    body: 'The dev server prints a DevTools URL per card. Plugins resolve from your package.json, exactly as they do on Metro.',
  },
];

export const Lynx = () => (
  <Section id="lynx" tint="subtle" bordered>
    <SectionHeader
      eyebrow={
        <span className={styles.label}>
          <BrandMark slug="lynx" label="Lynx" size={16} className={styles.mark} />
          Rozenite for Lynx
          <span className={styles.status}>Experimental</span>
        </span>
      }
      title="Same panels, same CLI, now on Lynx"
      body="Rozenite discovers Lynx apps over DebugRouter and bridges them to the Chrome DevTools Protocol, so the DevTools frontend React Native uses connects to a Lynx card unmodified."
    />

    <Reveal>
      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li className={styles.step} key={step.title}>
            <span className={styles.stepIndex}>{String(index + 1).padStart(2, '0')}</span>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepBody}>{step.body}</p>
          </li>
        ))}
      </ol>

      <div className={styles.bottom}>
        <div className={styles.setup}>
          <CommandLine command="npm install -D @rozenite/lynx" />
          <ActionButton href="/docs/targets/rozenite-for-lynx" variant="outline">
            Lynx setup guide
          </ActionButton>
        </div>

        <p className={styles.caveat}>
          Plugins that move state work today — controls, feature flags, React Hook Form and TanStack
          Query. Ones built on React Native APIs do not yet.
        </p>
      </div>
    </Reveal>
  </Section>
);
