import { act, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import ChatMessage from './ChatMessage.jsx';

describe('ChatMessage', () => {
  test('animates dots only while an assistant message is loading', () => {
    vi.useFakeTimers();

    try {
      const message = {
        id: 'assistant-1',
        role: 'assistant',
        text: '🔍 상품 검색 중',
        status: 'loading',
        results: [],
      };
      const { container, rerender } = render(<ChatMessage message={message} />);
      const loadingDots = container.querySelector('.loading-dots');

      expect(loadingDots).toHaveTextContent('');

      act(() => vi.advanceTimersByTime(400));
      expect(loadingDots).toHaveTextContent('.');

      act(() => vi.advanceTimersByTime(800));
      expect(loadingDots).toHaveTextContent('...');

      act(() => vi.advanceTimersByTime(400));
      expect(loadingDots).toHaveTextContent('');

      rerender(
        <ChatMessage
          message={{ ...message, text: '스트리밍 답변', status: 'streaming' }}
        />,
      );

      expect(screen.getByText('스트리밍 답변')).toBeInTheDocument();
      expect(container.querySelector('.loading-dots')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
