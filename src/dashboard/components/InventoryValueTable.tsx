import { useState } from 'react';
import type { ValuedInventoryItem } from '../../shared/types';

const DEFAULT_DUCATS_PER_PLATINUM = 8;

export function InventoryValueTable({ items }: { items: ValuedInventoryItem[] }) {
  const [ducatsPerPlatinum, setDucatsPerPlatinum] = useState(DEFAULT_DUCATS_PER_PLATINUM);
  const [recommendationSort, setRecommendationSort] = useState<'none' | 'desc' | 'asc'>('none');
  const recommendation = (item: ValuedInventoryItem) => {
    if (!item.ducats || item.quote?.ingameSellPrice == null) return '—';
    return item.ducats / item.quote.ingameSellPrice >= ducatsPerPlatinum ? '🪙杜卡德' : '💰白金';
  };
  const sortedItems = (() => {
    if (recommendationSort === 'none') return items;
    const rank = (item: ValuedInventoryItem) => ({ '🪙杜卡德': 2, '💰白金': 1, '—': 0 })[recommendation(item)];
    return items.map((item, index) => ({ item, index })).sort((left, right) => {
      const difference = rank(left.item) - rank(right.item);
      return (recommendationSort === 'desc' ? -difference : difference) || left.index - right.index;
    }).map(({ item }) => item);
  })();
  const toggleRecommendationSort = () => setRecommendationSort((current) => current === 'none' ? 'desc' : current === 'desc' ? 'asc' : 'none');
  const sortIndicator = recommendationSort === 'desc' ? '↓' : recommendationSort === 'asc' ? '↑' : '↕';
  return <><div className="filters"><label>杜卡德/白金阈值 <input aria-label="杜卡德/白金阈值" type="number" min="1" step="1" value={ducatsPerPlatinum} onChange={(event) => setDucatsPerPlatinum(Math.max(1, Number(event.target.value) || DEFAULT_DUCATS_PER_PLATINUM))}/> D/p</label><span className="muted">达到阈值建议 🪙杜卡德，否则建议 💰白金。</span></div><div className="table-wrap"><table className="table"><thead><tr><th>商品</th><th>售价</th><th>参考价</th><th>杜卡德</th><th aria-sort={recommendationSort === 'none' ? 'none' : recommendationSort === 'desc' ? 'descending' : 'ascending'}><button className="sort-button" onClick={toggleRecommendationSort}>建议 {sortIndicator}</button></th><th>查询页</th></tr></thead><tbody>{sortedItems.map((item, index) => <tr key={`${item.slug}-${index}`}><td>{item.displayName}</td><td>{item.quote?.ingameSellPrice == null ? '—' : `${item.quote.ingameSellPrice}p`}</td><td>{item.quote?.referenceSellPrice == null ? '—' : `${item.quote.referenceSellPrice}p`}</td><td>{item.ducats ? item.ducats : '—'}</td><td>{recommendation(item)}</td><td>{item.slug.startsWith('unrecognized-') ? '—' : <a className="market-link" href={`https://warframe.market/zh-hans/items/${encodeURIComponent(item.slug)}`} target="_blank" rel="noopener noreferrer">跳转</a>}</td></tr>)}</tbody></table></div>{!items.length && <p className="empty">没有识别到商品。</p>}</>;
}
