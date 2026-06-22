import type { ReactNode } from 'react';
import {
  Card,
  Description,
  JsonInspector,
  Surface,
  usePluginTheme,
} from '@rozenite/ui';

export type DetailsDisplayProps = {
  details?: unknown;
};

export function DetailsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <Card.Header>
        <div>
          <Card.Title>{title}</Card.Title>
          {description ? (
            <Card.Description className="mt-1 text-xs">
              {description}
            </Card.Description>
          ) : null}
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-0 p-0">
        {children}
      </Card.Content>
    </Card>
  );
}

export function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 border-t border-border/70 px-5 py-4 first:border-t-0 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
      <Description className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </Description>
      <div className="min-w-0 text-sm text-foreground">{children}</div>
    </div>
  );
}

export const DetailsDisplay = ({ details }: DetailsDisplayProps) => {
  const { resolvedTheme } = usePluginTheme();

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Details</h3>
        <Description className="mt-1 text-xs text-muted">
          Structured metadata captured for this performance entry.
        </Description>
      </div>

      <Surface className="min-h-0 overflow-auto p-4 text-sm" variant="secondary">
        {details == null ? (
          <div className="italic text-muted">No details provided</div>
        ) : (
          <JsonInspector
            collectionLimit={50}
            copyable
            data={details}
            hideRoot
            shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
            theme={resolvedTheme === 'light' ? 'light' : 'dark'}
          />
        )}
      </Surface>
    </section>
  );
};
