const colorMap: Record<string, NavigationTreeColors> = {};
let currentIndex = 0;

export const colorList = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const;

type NavigationTreeColors = (typeof colorList)[number];

export const getNavigationTreeColor = (color: NavigationTreeColors): string => {
  return `text-${color}-600`;
};

export const getNavigationTreeBorderColor = (
  color: NavigationTreeColors
): string => {
  return `border-${color}-600`;
};

export const getNavigationTreeBackgroundColor = (
  color: NavigationTreeColors
): string => {
  return `bg-${color}-600`;
};

export const generateColor = (key: string): NavigationTreeColors => {
  if (colorMap[key]) {
    return colorMap[key];
  }

  currentIndex = (currentIndex + 1) % colorList.length;
  const newColor = colorList[currentIndex];

  colorMap[key] = newColor;

  return newColor;
};
