// Escapes special characters in shell arguments
export function escapeShellArg(arg: string): string {
  if (!arg) return "''";

  // If the argument contains no special characters, return as is
  if (/^[a-zA-Z0-9_./:-]+$/.test(arg)) {
    return arg;
  }

  // Replace single quotes with '\'' and wrap in single quotes
  return `'${arg.replace(/'/g, "'\"'\"'")}'`;
}
