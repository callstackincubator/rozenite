const colorMap: Record<string, NavigationTreeColors> = {};
let currentIndex = 0;

// Categorical hues for the navigator tree. Violet, purple, fuchsia, pink and rose are left out:
// violet is Rozenite's retired brand colour and the pinks sit next to the new accent, so neither
// should read as a data category (docs/DESIGN.md, "DevTools panel UI").
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
] as const;

type NavigationTreeColors = (typeof colorList)[number];

export const getNavigationTreeColor = (color: NavigationTreeColors): string => {
  return `text-${color}-600`;
};

export const getNavigationTreeBorderColor = (color: NavigationTreeColors): string => {
  return `border-${color}-600`;
};

export const getNavigationTreeBackgroundColor = (color: NavigationTreeColors): string => {
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
