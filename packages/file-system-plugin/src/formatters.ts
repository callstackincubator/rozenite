// ============================================================================
// Content Formatters
// Add new formatters here to support pretty-printing additional formats.
// Each formatter returns { success: true, formatted: string } or { success: false }
// ============================================================================

type FormatResult = { success: true; formatted: string } | { success: false };

type ContentFormatter = (content: string) => FormatResult;

const formatters: ContentFormatter[] = [
  // JSON formatter
  (content: string): FormatResult => {
    try {
      const parsed = JSON.parse(content);
      return { success: true, formatted: JSON.stringify(parsed, null, 2) };
    } catch {
      return { success: false };
    }
  },

  // PLIST / XML formatter
  (content: string): FormatResult => {
    // Remove BOM if present and trim
    const cleaned = content.replace(/^\uFEFF/, '').trim();

    // Check if it looks like XML/PLIST (handle various XML starts)
    const looksLikeXml =
      cleaned.startsWith('<?xml') ||
      cleaned.startsWith('<!DOCTYPE') ||
      cleaned.startsWith('<plist') ||
      cleaned.startsWith('<dict') ||
      cleaned.startsWith('<array') ||
      (cleaned.startsWith('<') && cleaned.includes('</'));

    if (!looksLikeXml) {
      return { success: false };
    }

    try {
      return { success: true, formatted: formatXml(cleaned) };
    } catch {
      return { success: false };
    }
  },

  // Add more formatters here in the future:
  // - YAML formatter
  // - INI formatter
  // - etc.
];

function formatXml(xml: string): string {
  let formatted = '';
  let indent = 0;
  const tab = '  ';

  // Normalize: collapse all whitespace between tags, then split by tags
  const normalized = xml
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .replace(/</g, '\n<') // Add newline before each opening tag
    .replace(/>/g, '>\n') // Add newline after each closing tag
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const token of normalized) {
    // Handle closing tags - decrease indent first
    if (token.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      formatted += tab.repeat(indent) + token + '\n';
      continue;
    }

    // Handle self-closing tags and processing instructions
    if (
      token.endsWith('/>') ||
      token.startsWith('<?') ||
      token.startsWith('<!')
    ) {
      formatted += tab.repeat(indent) + token + '\n';
      continue;
    }

    // Handle opening tags with inline content like <string>value</string>
    if (token.startsWith('<') && token.includes('</')) {
      formatted += tab.repeat(indent) + token + '\n';
      continue;
    }

    // Handle opening tags - add then increase indent
    if (token.startsWith('<')) {
      formatted += tab.repeat(indent) + token + '\n';
      indent++;
      continue;
    }

    // Text content
    formatted += tab.repeat(indent) + token + '\n';
  }

  return formatted.trim();
}

export function formatTextPreview(content: string): string {
  // Try each formatter in order, return first successful result
  for (const formatter of formatters) {
    const result = formatter(content);
    if (result.success) {
      return result.formatted;
    }
  }
  // No formatter matched, return raw content
  return content;
}
