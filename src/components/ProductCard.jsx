import { useState } from 'react';

function safeProductUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '??' : value;
}

export default function ProductCard({ product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const title = String(product.title || product.product_id || '상품명 없음');
  const link = safeProductUrl(product.link);

  const content = (
    <>
      {product.image_url ? (
        <img
          className={imageFailed ? 'image-load-error' : undefined}
          src={String(product.image_url)}
          alt={`${title} 상품 이미지`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="product-image-fallback" role="img" aria-label="상품 이미지 없음">
          이미지 없음
        </div>
      )}
      <div className="product-title">{title}</div>
      <div className="product-low-price">
        최저가: {displayValue(product.lprice)}
      </div>
      <div className="product-mall">판매처: {product.mall_name || ''}</div>
    </>
  );

  if (!link) {
    return <div className="product-card product-card--unavailable">{content}</div>;
  }

  return (
    <a
      className="product-card"
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title} 상품 보기`}
    >
      {content}
    </a>
  );
}
