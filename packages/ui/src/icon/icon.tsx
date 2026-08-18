import type { ComponentType, SVGProps } from 'react';
import { cn } from '../utils/cn';
import { sizeIcon, type Size } from '../tokens/size';
import { textTone } from '../tokens/tone-variants';
import type { Tone } from '../tokens/tone';

export type IconProps = SVGProps<SVGSVGElement> & {
  /** Any icon component, e.g. a curated re-export from this module or a one-off glyph. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** @default 'md' */
  size?: Size;
  /** Overrides the icon's inherited color. */
  tone?: Tone;
};

/** Renders any icon component at a size from the shared `Size` scale. Decorative
 *  by default (`aria-hidden`) — set `aria-label` to make it accessible on its own. */
export function Icon({
  icon: IconComponent,
  size = 'md',
  tone,
  className,
  'aria-hidden': ariaHidden,
  ...props
}: IconProps) {
  return (
    <IconComponent
      data-slot="icon"
      aria-hidden={ariaHidden ?? (props['aria-label'] ? undefined : true)}
      className={cn(sizeIcon[size], 'shrink-0', tone && textTone({ tone }), className)}
      {...props}
    />
  );
}

export {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  Info,
  Minus,
  MoreHorizontal,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
