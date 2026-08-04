import { Fragment, type ReactNode } from 'react';

import styles from './code-sample.module.css';

type CodeSampleLanguage = 'ts' | 'shell';

type CodeSampleProps = {
  /** Shown on the left of the header strip, usually a file name. */
  title: string;
  /** Optional right-hand label, e.g. the language. */
  meta?: string;
  code: string;
  language?: CodeSampleLanguage;
  className?: string;
};

type Grammar = {
  /** Named groups: comment, string, flag, word. `flag` is shell only. */
  token: RegExp;
  keywords: Set<string>;
};

const GRAMMARS: Record<CodeSampleLanguage, Grammar> = {
  ts: {
    token:
      /(?<comment>\/\/[^\n]*)|(?<string>'[^']*'|"[^"]*"|`[^`]*`)|(?<word>[A-Za-z_$][\w$]*)/g,
    keywords: new Set([
      'import',
      'from',
      'export',
      'const',
      'let',
      'return',
      'async',
      'await',
      'function',
      'type',
      'interface',
      'new',
      'default',
      'as',
    ]),
  },
  shell: {
    token:
      /(?<comment>#[^\n]*)|(?<string>'[^']*'|"[^"]*")|(?<flag>--?[A-Za-z][\w-]*)|(?<word>[A-Za-z_][\w-]*)/g,
    keywords: new Set(['npx', 'npm', 'pnpm', 'yarn', 'rozenite']),
  },
};

/**
 * Deliberately small highlighter: comments, strings, flags and a fixed keyword
 * list. Enough to make short snippets readable without pulling in a grammar.
 */
const highlight = (code: string, language: CodeSampleLanguage): ReactNode[] => {
  const { token, keywords } = GRAMMARS[language];
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  token.lastIndex = 0;

  while ((match = token.exec(code)) !== null) {
    const text = match[0];
    const { comment, string, flag, word } = match.groups ?? {};

    if (word && !keywords.has(word)) {
      continue;
    }

    if (match.index > cursor) {
      nodes.push(code.slice(cursor, match.index));
    }

    const className = comment
      ? styles.comment
      : string
        ? styles.string
        : flag
          ? styles.flag
          : styles.keyword;

    nodes.push(
      <span className={className} key={match.index}>
        {text}
      </span>
    );
    cursor = match.index + text.length;
  }

  if (cursor < code.length) {
    nodes.push(code.slice(cursor));
  }

  return nodes;
};

export const CodeSample = ({
  title,
  meta,
  code,
  language = 'ts',
  className,
}: CodeSampleProps) => (
  <div className={[styles.root, className].filter(Boolean).join(' ')}>
    <div className={styles.head}>
      <span>{title}</span>
      {meta ? <span>{meta}</span> : null}
    </div>
    <pre className={styles.pre}>
      <code>
        {highlight(code, language).map((node, index) => (
          <Fragment key={index}>{node}</Fragment>
        ))}
      </code>
    </pre>
  </div>
);
