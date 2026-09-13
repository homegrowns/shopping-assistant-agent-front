import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import ProductCard from './ProductCard.jsx';

const product = {
  id: 'product-1',
  title: '나이키 모자',
  image_url: 'https://images.example.test/nike-cap.jpg',
  product_url: 'https://shop.example.test/nike-cap',
  sale_price: '39000',
  site: '예시몰',
};

describe('ProductCard', () => {
  test.each([30, 10, 0, 99.95, 100])(
    'shows the original price and %s percent without a calculated sale price',
    (discountRate) => {
      render(<ProductCard product={{ ...product, sale_price: '39,900', discount_rate: discountRate }} />);
      expect(screen.getByText('원가: 39,900원')).toBeInTheDocument();
      expect(screen.getByText(`${discountRate} %`)).toBeInTheDocument();
      expect(screen.queryByText(/할인가:/)).not.toBeInTheDocument();
    },
  );

  test.each([undefined, null, '', ' ', 'invalid', -1, 101])(
    'hides the discount for missing or invalid rate %s',
    (discountRate) => {
      render(<ProductCard product={{ ...product, discount_rate: discountRate }} />);
      expect(screen.queryByText(/할인:/)).not.toBeInTheDocument();
    },
  );

  test('renders tags received as a JSON string', () => {
    render(
      <ProductCard
        product={{
          ...product,
          tags: '["나이키모자", "나이키클럽", "나이키퓨추라", "퓨추라캡"]',
        }}
      />,
    );

    const tagList = screen.getByLabelText('상품 태그');
    expect(within(tagList).getByText('#나이키모자')).toBeInTheDocument();
    expect(within(tagList).getByText('#나이키클럽')).toBeInTheDocument();
    expect(within(tagList).getByText('#나이키퓨추라')).toBeInTheDocument();
    expect(within(tagList).getByText('#퓨추라캡')).toBeInTheDocument();
  });

  test('also accepts an array and ignores invalid tags', () => {
    const { rerender } = render(
      <ProductCard product={{ ...product, tags: ['모자', '', '모자', null] }} />,
    );

    expect(screen.getAllByText('#모자')).toHaveLength(1);

    rerender(<ProductCard product={{ ...product, tags: 'invalid json' }} />);
    expect(screen.queryByLabelText('상품 태그')).not.toBeInTheDocument();
  });
});
