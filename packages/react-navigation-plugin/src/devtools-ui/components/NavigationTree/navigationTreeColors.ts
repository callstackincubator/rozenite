export type NavigationTreeColor = {
  accent: string;
  onAccent: string;
  soft: string;
  softBorder: string;
};

const navigationTreeColors: NavigationTreeColor[] = [
  {
    accent: '#ef4444',
    onAccent: '#ffffff',
    soft: 'rgba(239, 68, 68, 0.14)',
    softBorder: 'rgba(239, 68, 68, 0.35)',
  },
  {
    accent: '#f97316',
    onAccent: '#ffffff',
    soft: 'rgba(249, 115, 22, 0.14)',
    softBorder: 'rgba(249, 115, 22, 0.35)',
  },
  {
    accent: '#eab308',
    onAccent: '#111827',
    soft: 'rgba(234, 179, 8, 0.16)',
    softBorder: 'rgba(234, 179, 8, 0.36)',
  },
  {
    accent: '#84cc16',
    onAccent: '#111827',
    soft: 'rgba(132, 204, 22, 0.16)',
    softBorder: 'rgba(132, 204, 22, 0.36)',
  },
  {
    accent: '#22c55e',
    onAccent: '#052e16',
    soft: 'rgba(34, 197, 94, 0.14)',
    softBorder: 'rgba(34, 197, 94, 0.34)',
  },
  {
    accent: '#14b8a6',
    onAccent: '#042f2e',
    soft: 'rgba(20, 184, 166, 0.14)',
    softBorder: 'rgba(20, 184, 166, 0.34)',
  },
  {
    accent: '#06b6d4',
    onAccent: '#083344',
    soft: 'rgba(6, 182, 212, 0.14)',
    softBorder: 'rgba(6, 182, 212, 0.34)',
  },
  {
    accent: '#3b82f6',
    onAccent: '#eff6ff',
    soft: 'rgba(59, 130, 246, 0.14)',
    softBorder: 'rgba(59, 130, 246, 0.34)',
  },
  {
    accent: '#6366f1',
    onAccent: '#eef2ff',
    soft: 'rgba(99, 102, 241, 0.14)',
    softBorder: 'rgba(99, 102, 241, 0.34)',
  },
  {
    accent: '#8b5cf6',
    onAccent: '#f5f3ff',
    soft: 'rgba(139, 92, 246, 0.14)',
    softBorder: 'rgba(139, 92, 246, 0.34)',
  },
  {
    accent: '#d946ef',
    onAccent: '#fdf4ff',
    soft: 'rgba(217, 70, 239, 0.14)',
    softBorder: 'rgba(217, 70, 239, 0.34)',
  },
  {
    accent: '#ec4899',
    onAccent: '#fdf2f8',
    soft: 'rgba(236, 72, 153, 0.14)',
    softBorder: 'rgba(236, 72, 153, 0.34)',
  },
];

const colorMap = new Map<string, NavigationTreeColor>();
let currentIndex = -1;

export const generateColor = (key: string): NavigationTreeColor => {
  const existingColor = colorMap.get(key);

  if (existingColor) {
    return existingColor;
  }

  currentIndex = (currentIndex + 1) % navigationTreeColors.length;
  const newColor = navigationTreeColors[currentIndex];

  colorMap.set(key, newColor);
  return newColor;
};
