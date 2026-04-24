export const cn = (...classNames: Array<string | false | null | undefined>) =>
  classNames.filter(Boolean).join(' ');
