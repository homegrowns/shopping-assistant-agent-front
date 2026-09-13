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

function formatPrice(value) {
  const displayed = displayValue(value);
  const amount = Number(String(displayed).replaceAll(',', ''));
  return Number.isFinite(amount) ? amount.toLocaleString('ko-KR') : displayed;
}

function productTags(value) {
  let tags = value;

  if (typeof value === 'string') {
    if (!value.trim()) return [];

    try {
      tags = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(tags)) return [];

  return [...new Set(
    tags
      .filter((tag) => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter(Boolean),
  )];
}

export default function ProductCard({ product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const title = String(product.title || product.product_id || '상품명 없음');
  const link = safeProductUrl(product.product_url);
  const tags = productTags(product.tags);
  const discountRate = Number(product.discount_rate);
  const hasDiscount = String(product.discount_rate ?? '').trim() !== ''
    && Number.isFinite(discountRate) && discountRate >= 0 && discountRate <= 100;

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
      <div className="product-price">
        원가: {formatPrice(product.sale_price)}원
      </div>
      {hasDiscount && (
        <div className="product-discount-rate">
          할인: <span className="product-discount-value">{discountRate} %</span>
          <div className="product-discount-notice">
            할인율은 판매처 사정에 따라 변경될 수 있습니다.
          </div>
        </div>
      )}
      <div className="product-mall">판매처: {product.site || ''}</div>
      {tags.length ? (
        <div className="product-tags" aria-label="상품 태그">
          {tags.map((tag) => (
            <span className="product-tag" key={tag}>#{tag}</span>
          ))}
        </div>
      ) : null}
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
