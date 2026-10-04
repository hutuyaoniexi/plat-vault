const OCR_REPLACEMENTS: Array<[RegExp, string]> = [
  [/prirne|prlme|pr1me/gi, 'prime'],
  [/\b0(?=[a-z])/gi, 'o'],
  [/(?<=[a-z])1(?=[a-z])/gi, 'l']
];

export function normalizeItemName(text: string): string {
  let value = text.normalize('NFKC').toLowerCase().trim();
  for (const [pattern, replacement] of OCR_REPLACEMENTS) value = value.replace(pattern, replacement);
  return value
    .replace(/[，,。、“”"'`~!@#$%^&*()_+={}[\]|\\:;<>?／/、·…—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*([\u4e00-\u9fff])\s*/g, '$1')
    .trim();
}
