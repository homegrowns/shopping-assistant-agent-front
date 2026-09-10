import ProductCard from './ProductCard.jsx';

function productKey(product) {
  return String(
    product.id ||
      product.product_url ||
      `${product.image_url || 'no-image'}-${product.title || 'untitled'}`,
  );
}

export default function ProductGrid({ products }) {
  if (!products.length) return null;

  const keyOccurrences = new Map();

  return (
    <div className="product-grid" aria-label="상품 검색 결과">
      {products.map((product) => {
        const baseKey = productKey(product);
        const occurrence = keyOccurrences.get(baseKey) || 0;
        keyOccurrences.set(baseKey, occurrence + 1);
        const key = occurrence ? `${baseKey}-${occurrence}` : baseKey;
        return <ProductCard key={key} product={product} />;
      })}
    </div>
  );
}
