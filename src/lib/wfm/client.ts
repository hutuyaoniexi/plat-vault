import {CATALOG_TTL_MS, MAX_RETRY_AFTER_MS} from '../../shared/constants';
import {fetchWithTimeout} from '../fetchWithTimeout';
import {getLocal, setLocal} from '../storage/localStore';
import {toCatalogItem} from './catalog';
import {RateLimiter} from './rateLimiter';
import {retryAfterDelay} from './retryAfter';
import type {CatalogItem, MarketOrder} from './types';

const BASE_URL = import.meta.env.DEV ? '/wfm-api/v2' : 'https://api.warframe.market/v2';
const CATALOG_CACHE_KEY = 'wfm-catalog-v2';
interface CachedCatalog { fetchedAt: number; items: CatalogItem[]; }
function responseArray(value: unknown): unknown[] {
  if (typeof value !== 'object' || value === null || !('data' in value) || !Array.isArray(value.data)) {
    throw new Error('warframe.market 返回了无法识别的数据格式');
  }
  return value.data;
}

function isMarketOrder(value: unknown): value is MarketOrder {
  if (typeof value !== 'object' || value === null) return false;
  const order = value as Record<string, unknown>;
  return typeof order.id === 'string'
    && (order.type === 'buy' || order.type === 'sell')
    && typeof order.platinum === 'number' && Number.isFinite(order.platinum)
    && typeof order.user === 'object' && order.user !== null;
}

export class WfmClient {
  private readonly queue = new RateLimiter();
  private readonly orderRequests = new Map<string, Promise<MarketOrder[]>>();

  async getCatalog(forceRefresh = false): Promise<CatalogItem[]> {
    const cached = await getLocal<CachedCatalog>(CATALOG_CACHE_KEY);
    if (cached && !forceRefresh && Date.now() - cached.fetchedAt < CATALOG_TTL_MS) return cached.items;
    try {
      const response = await this.request<unknown>('/items');
      const items = responseArray(response).map(toCatalogItem).filter((item): item is CatalogItem => item !== null);
      try { await setLocal(CATALOG_CACHE_KEY, { fetchedAt: Date.now(), items }); }
      catch { /* A full or unavailable local cache must not discard fresh catalog data. */ }
      return items;
    } catch (error) {
      if (cached) return cached.items;
      throw error;
    }
  }

  getOrders(slug: string, signal?: AbortSignal): Promise<MarketOrder[]> {
    const existing = this.orderRequests.get(slug);
    if (existing) return existing;
    const request = this.request<unknown>(`/orders/item/${encodeURIComponent(slug)}`, signal).then((response) => responseArray(response).filter(isMarketOrder)).finally(() => this.orderRequests.delete(slug));
    this.orderRequests.set(slug, request);
    return request;
  }

  private request<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.queue.add(async () => {
      let lastError: Error | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let retryDelay = 400 * (2 ** attempt);
        try {
          const response = await fetchWithTimeout(`${BASE_URL}${path}`, { signal, headers: { Accept: 'application/json', Language: 'zh-hans', Platform: 'pc', Crossplay: 'true' } });
          if (response.status === 429) {
            retryDelay = Math.min(MAX_RETRY_AFTER_MS, retryAfterDelay(response.headers.get('Retry-After')) ?? 2_000 * (attempt + 1));
            this.queue.deferFor(retryDelay);
            lastError = new Error('warframe.market 请求过于频繁，正在退避重试');
          } else if (response.ok) return await response.json() as T;
          else if (response.status >= 500) lastError = new Error(`warframe.market 暂时不可用 (${response.status})`);
          else { const requestError = new Error(`warframe.market 请求失败 (${response.status})`); requestError.name = 'NonRetryableError'; throw requestError; }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') throw error;
          if (error instanceof Error && error.name === 'NonRetryableError') throw error;
          lastError = error instanceof Error ? error : new Error('网络请求失败');
        }
        if (attempt < 2) await new Promise<void>((resolve) => setTimeout(resolve, retryDelay));
      }
      throw lastError ?? new Error('请求失败');
    }, signal);
  }
}

export const wfmClient = new WfmClient();
