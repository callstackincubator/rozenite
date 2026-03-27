import { JSONTree } from 'react-json-tree';
import type {
  SqliteQueryMetadata,
  SqliteQueryResult,
  SqliteScriptResult,
} from '../shared/types';
import { truncateText } from './utils';

const jsonTreeTheme = {
  base00: 'transparent',
  base01: '#10233c',
  base02: '#173150',
  base03: '#7b94b6',
  base04: '#bfd0e5',
  base05: '#eef5ff',
  base06: '#ffffff',
  base07: '#ffffff',
  base08: '#fb7185',
  base09: '#f59e0b',
  base0A: '#facc15',
  base0B: '#34d399',
  base0C: '#22d3ee',
  base0D: '#60a5fa',
  base0E: '#78b8ff',
  base0F: '#f97316',
};

export const isStructuredValue = (
  value: unknown,
): value is Record<string, unknown> | unknown[] => {
  return Array.isArray(value) || (!!value && typeof value === 'object');
};

export const getValueKind = (value: unknown) => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'number')
      ? 'blob-ish'
      : 'array';
  }

  return typeof value;
};

export const stringifyValue = (value: unknown) => {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const getValuePreview = (value: unknown, maxLength = 120) => {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return truncateText(value.replace(/\s+/g, ' '), maxLength);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return `byte[${value.length}] ${truncateText(JSON.stringify(value), maxLength)}`;
  }

  return truncateText(stringifyValue(value).replace(/\s+/g, ' '), maxLength);
};

export const getMetadataBadgeClassName = (metadata: SqliteQueryMetadata) => {
  if (
    metadata.statementType === 'select' ||
    metadata.statementType === 'pragma' ||
    metadata.statementType === 'with' ||
    metadata.statementType === 'explain'
  ) {
    return 'sqlite-badge sqlite-badge-success';
  }

  if (
    metadata.statementType === 'insert' ||
    metadata.statementType === 'update' ||
    metadata.statementType === 'delete'
  ) {
    return 'sqlite-badge sqlite-badge-warning';
  }

  return 'sqlite-badge sqlite-badge-neutral';
};

export const renderStructuredValue = (value: unknown) => {
  if (!isStructuredValue(value)) {
    return null;
  }

  return (
    <JSONTree
      data={value}
      theme={jsonTreeTheme}
      invertTheme={false}
      shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
    />
  );
};

export const getResultSummary = (result: SqliteQueryResult | null) => {
  if (!result) {
    return null;
  }

  const { metadata } = result;

  if (metadata.rowCount > 0) {
    return `${metadata.rowCount} rows returned`;
  }

  if (metadata.changes != null) {
    return `${metadata.changes} rows changed`;
  }

  return 'Statement executed';
};

export const getScriptResultSummary = (result: SqliteScriptResult | null) => {
  if (!result) {
    return null;
  }

  const executedCount = result.statements.length;

  if (result.failedStatementIndex != null) {
    return `Executed ${executedCount} of ${result.totalStatementCount} statements before failing`;
  }

  if (result.totalStatementCount === 1) {
    return 'Executed 1 statement';
  }

  return `Executed ${result.totalStatementCount} statements`;
};
