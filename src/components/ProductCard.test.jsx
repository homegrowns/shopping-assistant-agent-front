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
