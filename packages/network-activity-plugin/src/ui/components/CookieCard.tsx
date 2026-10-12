import { Badge, Text } from '@rozenite/ui';
import { Cookie } from '../../shared/client';

type CookieCardProps = {
  cookie: Cookie;
};

const CookieAttribute = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <Text variant="label" className="text-[10px]">
      {label}
    </Text>
    <Text variant="code" className="wrap-anywhere text-muted-foreground">
      {value}
    </Text>
  </div>
);

export const CookieCard = ({ cookie }: CookieCardProps) => (
  <div className="flex flex-col gap-2 border border-border bg-surface p-3">
    <div className="flex items-center justify-between gap-2">
      <Text variant="code" className="wrap-anywhere">
        {cookie.name}
      </Text>
      <div className="flex shrink-0 items-center gap-1.5">
        {cookie.secure && (
          <Badge tone="warning" variant="soft" size="sm">
            Secure
          </Badge>
        )}
        {cookie.httpOnly && (
          <Badge tone="neutral" variant="soft" size="sm">
            HttpOnly
          </Badge>
        )}
      </div>
    </div>
    <Text variant="code" className="wrap-anywhere text-muted-foreground">
      {cookie.value}
    </Text>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {cookie.domain && <CookieAttribute label="Domain" value={cookie.domain} />}
      {cookie.path && <CookieAttribute label="Path" value={cookie.path} />}
      {cookie.expires && <CookieAttribute label="Expires" value={cookie.expires} />}
      {cookie.maxAge && <CookieAttribute label="Max-Age" value={cookie.maxAge} />}
      {cookie.sameSite && <CookieAttribute label="SameSite" value={cookie.sameSite} />}
    </div>
  </div>
);
