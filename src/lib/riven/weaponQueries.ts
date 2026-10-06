import {traits} from './traits';

const ignoredLines = /(riven|reroll|re-roll|polarity|rank|kuva|unveil|cycle|mod config|upgrade|capacity|drain|紫卡|段位)/i;

export function weaponQueriesFromOcr(lines: string[]): string[] {
  const usable = lines.map((line) => line.trim()).filter((line) =>
    (/^[a-z][a-z0-9 '-]{2,38}$/i.test(line) || /[\u4e00-\u9fff]{2,}/.test(line))
    && !traits.some((trait) => trait.aliases.some((alias) => line.toLowerCase().includes(alias.toLowerCase())))
    && !ignoredLines.test(line));
  const chineseNames = usable.flatMap((line) => line.match(/[\u4e00-\u9fff]{2,}/g) ?? []);
  // The Chinese localized name is often OCR'd with one wrong trailing glyph.
  // Short prefixes still let the online API resolve the weapon by its name.
  const chinesePrefixes = [
    ...chineseNames.map((name) => name.slice(0,2)),
    ...chineseNames.map((name) => name.slice(0,3)),
    ...chineseNames
  ];
  const otherCandidates: string[] = [];
  for (let index=0; index<usable.length; index+=1) {
    const words=usable[index].split(/\s+/);
    if (words.length<=4) otherCandidates.push(usable[index]);
    if (words.length>1) { otherCandidates.push(words.slice(0,2).join(' ')); otherCandidates.push(...words.filter((word) => word.length>=3)); }
    else otherCandidates.push(words[0]);
    if (index+1<usable.length && words.length<=2 && usable[index+1].split(/\s+/).length<=2) otherCandidates.push(`${usable[index]} ${usable[index+1]}`);
  }
  return [...new Set([...chinesePrefixes,...otherCandidates])].filter(Boolean).slice(0,16);
}
