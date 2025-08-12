import { Badge } from './Badge';
import { Cookie } from '../../shared/client';
import { cn } from '../utils/cn';

type CookieCardProps = {
  cookie: Cookie;
  keyClassName?: string;
};

export const CookieCard = ({ cookie, keyClassName }: CookieCardProps) => (
  <div className="bg-gray-800 border border-gray-700 rounded p-3">
    <div className="flex items-center justify-between mb-2">
      <span className={cn('text-sm font-medium', keyClassName)}>
        {cookie.name}
      </span>
      <div className="flex items-center gap-2">
        {cookie.secure && (
          <Badge
            variant="outline"
            className="text-xs text-yellow-400 border-yellow-400"
          >
            Secure
          </Badge>
        )}
        {cookie.httpOnly && (
          <Badge
            variant="outline"
            className="text-xs text-purple-400 border-purple-400"
          >
            HttpOnly
          </Badge>
        )}
      </div>
    </div>
    <div className="text-sm text-gray-300 mb-2 break-all">{cookie.value}</div>
    <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
      {cookie.domain && (
        <div>
          <span className="font-medium">Domain:</span> {cookie.domain}
        </div>
      )}
      {cookie.path && (
        <div>
          <span className="font-medium">Path:</span> {cookie.path}
        </div>
      )}
      {cookie.expires && (
        <div>
          <span className="font-medium">Expires:</span> {cookie.expires}
        </div>
      )}
      {cookie.maxAge && (
        <div>
          <span className="font-medium">Max-Age:</span> {cookie.maxAge}
        </div>
      )}
      {cookie.sameSite && (
        <div>
          <span className="font-medium">SameSite:</span> {cookie.sameSite}
        </div>
      )}
    </div>
  </div>
);
