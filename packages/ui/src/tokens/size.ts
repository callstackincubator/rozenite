export type Size = 'sm' | 'md' | 'lg';

/** Control height per size step. `md` is the default control height today. */
export const sizeHeight: Record<Size, string> = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
};

/** Horizontal padding per size step, for controls that pad by height. */
export const sizePaddingX: Record<Size, string> = {
  sm: 'px-2',
  md: 'px-3',
  lg: 'px-4',
};

/** Icon size (`size-*`) to pair with each control size step. */
export const sizeIcon: Record<Size, string> = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
};
