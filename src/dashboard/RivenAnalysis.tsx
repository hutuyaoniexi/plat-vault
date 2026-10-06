import {useCallback, useEffect, useRef, useState} from 'react';
import {OcrService} from '../lib/ocr/recognize';
import {normalizeItemName} from '../lib/matching/normalize';
import {analyzeRiven} from '../lib/riven/recommend';
import {traitName, traits} from '../lib/riven/traits';
import type {RivenTrait, Weapon} from '../lib/riven/types';
import {chooseWeapon, searchWeapon} from '../lib/riven/weaponClient';
import {weaponQueriesFromOcr} from '../lib/riven/weaponQueries';
import {parseTraitValue} from '../lib/riven/parseTraitValue';
import {rivenStatMaximum, rivenStatMaximumLabel} from '../lib/riven/statCaps';
import type {ScreenshotAsset} from '../shared/types';

interface Props { screenshots: ScreenshotAsset[]; startKey: number; onProgress: (id: string, progress: number, status: string, error?: string) => void; onComplete: (completed: boolean) => void; }

export function RivenAnalysis({screenshots, startKey, onProgress, onComplete}: Props) {
  const [weapon, setWeapon] = useState<Weapon>(); const [traitsState, setTraitsState] = useState<RivenTrait[]>([]); const [rerolls, setRerolls] = useState('0'); const [ocrText, setOcrText] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(() => startKey > 0);
  const service = useRef<OcrService | undefined>(undefined);
  useEffect(() => () => service.current?.terminate(), []);
  const result = weapon ? analyzeRiven(weapon, {traits:traitsState,rerolls:Number(rerolls)||0}) : null;
  const currentTraits = result ? [...result.positives,...result.negatives] : [];
  const desiredGoals = result ? (result.desired.length ? result.desired : ['多重射击', '基础伤害', '武器核心词条', '无害负面'])
    .map((name, originalIndex) => ({name, originalIndex, traitId: traits.find((trait) => trait.name === name)?.id}))
    .sort((a, b) => {
      const aIndex = currentTraits.findIndex((trait) => trait.id === a.traitId);
      const bIndex = currentTraits.findIndex((trait) => trait.id === b.traitId);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.originalIndex - b.originalIndex;
    }) : [];
  const remainingGoals = desiredGoals.filter((goal) => !currentTraits.some((trait) => !trait.negative && trait.id === goal.traitId));
  const lockAdvice = result?.lockAdvice ?? '';
  const recommendedLock = lockAdvice.startsWith('推荐锁定：');
  const lockResult = recommendedLock ? lockAdvice.split('。')[0] : '暂无值得锁定的词条';
  const lockExplanation = recommendedLock
    ? lockAdvice.slice(lockResult.length + 1)
    : lockAdvice.replace('暂无值得锁定的词条，', '');
  const scanRiven = useCallback(async (source: ScreenshotAsset[]) => {
    setWeapon(undefined); setTraitsState([]); setOcrText(''); setBusy(true); setMessage('正在本地识别已上传的紫卡截图…');
    const ocr = service.current ?? new OcrService(); service.current = ocr;
    for (const [index,screenshot] of source.entries()) {
      onProgress(screenshot.id,0,`紫卡截图 ${index+1}/${source.length}：准备识别`);
      try {
        const {text,lines} = await ocr.recognizeTextWithLines(screenshot.id,screenshot.file,(percentage,status) => onProgress(screenshot.id,percentage*0.65,`紫卡截图 ${index+1}/${source.length}：${status}`),'riven'); setOcrText(text);
        const uniqueCandidates = weaponQueriesFromOcr(lines.map((line) => line.text));
        onProgress(screenshot.id,0.7,'正在在线查询武器资料');
        const matches = [];
        for (let offset = 0; offset < uniqueCandidates.length; offset += 4) {
          const batch = uniqueCandidates.slice(offset, offset + 4);
          matches.push(...(await Promise.all(batch.map((candidate) => searchWeapon(candidate)))).flat());
        }
        const detected = chooseWeapon(matches,uniqueCandidates);
        if (!detected) { onProgress(screenshot.id,1,'未能识别武器名称'); continue; }
        setWeapon(detected);
        const detectedTraits: RivenTrait[] = [];
        for (const line of lines) {
          const normalizedLine = normalizeItemName(line.text);
          const found = traits.find((trait) => trait.aliases.some((alias) => normalizedLine.includes(normalizeItemName(alias))));
          if (!found || detectedTraits.some((trait) => trait.id === found.id)) continue;
          const {value,negative} = parseTraitValue(line.text,found.id);
          const explicitlyNegative = negative || /^\s*-|\bnegative\b|负面|负向/i.test(line.text);
          detectedTraits.push({id:found.id,value,negative:explicitlyNegative});
        }
        setTraitsState(detectedTraits);
        const rerollMatch = `${text}\n${lines.map((line) => line.text).join('\n')}`.match(/(?:re\s*rolls?|rerolls?|循环|重洗)\s*[:：]?\s*(\d+)/i); if (rerollMatch) setRerolls(rerollMatch[1]);
        setMessage(`已从截图识别武器，并在线加载 ${detected.name} 的资料。请核对武器和词条识别结果。`);
        onProgress(screenshot.id,1,'紫卡识别完成'); setBusy(false); onComplete(true); return;
      } catch (error) { onProgress(screenshot.id,0,'紫卡识别失败',error instanceof Error ? error.message : '识别失败'); }
    }
    setMessage('无法从已上传截图识别出武器。请返回图片页，调整或重新上传清晰的紫卡截图后重试。'); setBusy(false); onComplete(false);
  },[onComplete,onProgress]);
  const startedKey = useRef(0);
  useEffect(() => { if (startKey > 0 && startedKey.current !== startKey) { startedKey.current=startKey; void scanRiven(screenshots); } },[scanRiven,screenshots,startKey]);
  return <div className={`riven-layout${weapon ? ' has-result' : ''}`}>
    {!busy && !weapon && <section className="card riven-input"><h2>紫卡分析</h2><p className="muted">使用上方已上传的截图进行本地 OCR，识别武器和词条后在线查询武器面板及 Riven Disposition。完整截图不会上传，只有识别出的武器名称会发送给武器数据服务。</p>{message && <p className="muted" role="status">{message}</p>}{ocrText && <details><summary>查看 OCR 原文</summary><pre className="riven-ocr">{ocrText}</pre></details>}</section>}
    {weapon && result && <section className="card riven-result"><div className="riven-weapon-summary"><div><span>武器</span><strong>{weapon.name}</strong></div><div><span>武器类型</span><strong>{result.kind}</strong></div><div className={`riven-retention retention-${result.retention.level}`}><strong>{result.retention.label}</strong><small>{result.retention.reason}</small></div></div><div className="riven-detail-row"><section className="riven-current-panel"><h3>当前紫卡</h3>{!currentTraits.length ? <p>还没有添加紫卡词条。</p> : <div className="current-riven-traits">{currentTraits.map((trait,index) => { const matchedGoal = desiredGoals.find((goal) => !trait.negative && goal.traitId === trait.id); const unmatchedIndex = currentTraits.slice(0,index).filter((entry) => entry.negative || !result.desired.includes(traitName(entry.id))).length; const goal = matchedGoal ?? remainingGoals[unmatchedIndex % Math.max(remainingGoals.length,1)]; const cap = goal?.traitId ? rivenStatMaximum(goal.traitId, weapon, result.positives.length, result.negatives.length) : undefined; const goalLabel = matchedGoal ? `上限 ${cap === undefined ? '暂不可用' : rivenStatMaximumLabel(goal.traitId!, cap)}` : goal ? `推荐：${goal.name} ${cap === undefined ? '上限暂不可用' : rivenStatMaximumLabel(goal.traitId!, cap)}` : '已包含主要毕业词条'; return <div className={`current-riven-trait ${matchedGoal ? 'is-graduated' : 'is-not-graduated'}`} key={`${trait.id}-${index}`}><span>{trait.negative ? '-' : ''}{traitName(trait.id)} {trait.value ? `${trait.value}%` : ''}</span><strong className={`trait-score score-${trait.grade}`}>评分 {trait.score}/5</strong><span className={`current-riven-goal ${matchedGoal ? 'matched' : ''}`}>{goalLabel}</span></div>; })}</div>}<small className="riven-cap-note">数值上限按线上武器倾向值、识别到的正负词条数和 Wiki 计算规则估算。</small></section><details className="riven-weapon-analysis" open><summary>武器分析</summary>{result.notes.map((note) => <p key={note}>{note}</p>)}<p>分析参考武器基础属性、范围攻击和紫卡倾向值，不根据当前紫卡词条评级决定是否保留。</p></details></div><section className="riven-lock-recommendation"><strong className={recommendedLock ? 'is-recommended' : ''}>{lockResult}</strong><p>{lockExplanation}</p></section></section>}
  </div>;
}
