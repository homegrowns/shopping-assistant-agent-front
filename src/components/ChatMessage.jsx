import { useEffect, useState } from 'react';
import ProductGrid from './ProductGrid.jsx';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const showLoadingDots = !isUser && message.status === 'loading';
  const [loadingDots, setLoadingDots] = useState('');

  useEffect(() => {
    if (!showLoadingDots) return undefined;

    const intervalId = setInterval(() => {
      setLoadingDots((dots) => (dots === '...' ? '' : `${dots}.`));
    }, 400);

    return () => clearInterval(intervalId);
  }, [showLoadingDots]);

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-bubble">
        {message.imageUrl ? (
          <img
            src={message.imageUrl}
            className="message-thumbnail"
            alt="첨부한 상품 이미지"
          />
        ) : null}
        {isUser ? (
          message.text ? <div className="message-text">{message.text}</div> : null
        ) : (
          <>
            <div
              className="status-line"
              role={message.status === 'error' ? 'alert' : 'status'}
            >
              {message.text}
              {showLoadingDots ? (
                <span className="loading-dots" aria-hidden="true">
                  {loadingDots}
                </span>
              ) : null}
            </div>
            <ProductGrid products={message.results || []} />
          </>
        )}
      </div>
    </div>
  );
}
