export interface CatalogItem { id: string; slug: string; nameEn: string; nameZhHans?: string; normalizedNames: string[]; tags: string[]; ducats?: number; requiresSpecification: boolean; }
export interface MarketOrder { id: string; type: 'buy' | 'sell'; platinum: number; quantity?: number; visible?: boolean; user: { ingameName?: string; status?: string; platform?: string }; }
