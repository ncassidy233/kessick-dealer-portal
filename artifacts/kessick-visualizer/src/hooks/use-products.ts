import { useQuery } from '@tanstack/react-query';
import { parseCatalogEnvelope, resolveProductImageUrl, resolveProductThumbnailUrl } from '@/lib/catalog-domain';
export type { Product } from '@/types/catalog';
export { resolveProductImageUrl, resolveProductThumbnailUrl };

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await fetch(import.meta.env.BASE_URL + 'data/kessick-products.json');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      return parseCatalogEnvelope(data).products;
    },
  });
}
