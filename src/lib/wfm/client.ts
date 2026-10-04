import { CATALOG_TTL_MS } from '../../shared/constants';
import { getLocal, setLocal } from '../storage/localStore';
import { toCatalogItem } from './catalog';
import { RateLimiter } from './rateLimiter';
import type { CatalogItem, MarketOrder, MarketProvider } from './types';

const BASE_URL = import.meta.env.DEV ? '/wfm-api/v2' : 'https://api.warframe.market/v2';
const CATALOG_CACHE_KEY = 'wfm-catalog-v2';
interface CachedCatalog { fetchedAt: number; items: CatalogItem[]; }
interface WfmResponse<T> { data: T; }

export class WfmClient implements MarketProvider {
  private readonly queue = new RateLimiter();
  private readonly orderRequests = new Map<string, Promise<MarketOrder[]>>();

  async getCatalog(forceRefresh = false): Promise<CatalogItem[]> {
    const cached = await getLocal<CachedCatalog>(CATALOG_CACHE_KEY);
    if (cached && !forceRefresh && Date.now() - cached.fetchedAt < CATALOG_TTL_MS) return cached.items;
    try {
      const response = await this.request<WfmResponse<unknown[]>>('/items');
      const items = response.data.map((item) => toCatalogItem(item as Parameters<typeof toCatalogItem>[0])).filter((item): item is CatalogItem => item !== null);
      await setLocal(CATALOG_CACHE_KEY, { fetchedAt: Date.now(), items });
      return items;
    } catch (error) {
      if (cached) return cached.items;
      throw error;
    }
  }

  getOrders(slug: string, signal?: AbortSignal): Promise<MarketOrder[]> {
    const existing = this.orderRequests.get(slug);
    if (existing) return existing;
    const request = this.request<WfmResponse<MarketOrder[]>>(`/orders/item/${encodeURIComponent(slug)}`, signal).then((response) => response.data).finally(() => this.orderRequests.delete(slug));
    this.orderRequests.set(slug, request);
    return request;
  }

  private request<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.queue.add(async () => {
      let lastError: Error | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let retryDelay = 400 * (2 ** attempt);
        try {
          const response = await fetch(`${BASE_URL}${path}`, { signal, headers: { Accept: 'application/json', Language: 'zh-hans', Platform: 'pc', Crossplay: 'true' } });
          if (response.status === 429) {
            const seconds = Number(response.headers.get('Retry-After'));
            retryDelay = Number.isFinite(seconds) ? seconds * 1000 : 2_000 * (attempt + 1);
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
        await new Promise<void>((resolve) => setTimeout(resolve, retryDelay));
      }
      throw lastError ?? new Error('请求失败');
    }, signal);
  }
}

export const wfmClient = new WfmClient();
