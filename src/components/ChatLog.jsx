import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage.jsx';

export default function ChatLog({ messages }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={logRef}
      className="chat-log"
      role="log"
      aria-label="쇼핑 검색 대화"
      aria-live="polite"
    >
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  );
}
