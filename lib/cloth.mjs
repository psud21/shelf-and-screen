export const clothCount = 8;

/** The cloth colour for a title: always the same for the same title. @param {string} title */
export function clothFor(title) {
  let hash = 0;
  for (const char of String(title)) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return (hash % clothCount) + 1;
}
