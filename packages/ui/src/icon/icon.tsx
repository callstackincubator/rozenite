import type { ComponentType, SVGProps } from 'react';
import { cn } from '../utils/cn';
import { sizeIcon, type Size } from '../tokens/size';

export type IconProps = SVGProps<SVGSVGElement> & {
  /** Any icon component, e.g. a curated re-export from this module or a one-off glyph. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** @default 'md' */
  size?: Size;
};

/** Renders any icon component at a size from the shared `Size` scale. */
export function Icon({ icon: IconComponent, size = 'md', className, ...props }: IconProps) {
  return (
    <IconComponent
      data-slot="icon"
      className={cn(sizeIcon[size], 'shrink-0', className)}
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
