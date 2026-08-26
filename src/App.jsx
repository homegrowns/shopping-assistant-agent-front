import { useEffect, useRef, useState } from 'react';
import { searchProducts, uploadImage } from './api/shoppingApi.js';
import ChatLog from './components/ChatLog.jsx';
import Composer from './components/Composer.jsx';
import { useObjectUrl } from './hooks/useObjectUrl.js';

let fallbackMessageId = 0;

function makeMessageId(prefix) {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  fallbackMessageId += 1;
  return `${prefix}-${fallbackMessageId}`;
}

function errorMessage(error) {
  return error instanceof Error && error.message
    ? error.message
    : '알 수 없는 오류가 발생했습니다.';
}

export default function App() {
  const [messageInput, setMessageInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewUrl = useObjectUrl(selectedFile);
  const isSubmittingRef = useRef(false);
  const messageImageUrlsRef = useRef(new Set());
  const requestControllerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const messageImageUrls = messageImageUrlsRef.current;
    return () => {
      mountedRef.current = false;
      requestControllerRef.current?.abort();
      messageImageUrls.forEach((url) => URL.revokeObjectURL(url));
      messageImageUrls.clear();
    };
  }, []);

  function updateAssistantMessage(id, updates) {
    if (!mountedRef.current) return;
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, ...updates } : message,
      ),
    );
  }

  async function handleSubmit() {
    const message = messageInput.trim();
    const fileToUpload = selectedFile;

    if (isSubmittingRef.current || (!message && !fileToUpload)) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const userImageUrl = fileToUpload
      ? URL.createObjectURL(fileToUpload)
      : null;
    if (userImageUrl) messageImageUrlsRef.current.add(userImageUrl);

    const assistantId = makeMessageId('assistant');
    const userMessage = {
      id: makeMessageId('user'),
      role: 'user',
      text: message,
      imageUrl: userImageUrl,
    };
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      text: fileToUpload ? '📤 업로드 준비 중...' : '🔍 유사 상품 검색 중...',
      status: 'loading',
      results: [],
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setMessageInput('');
    setSelectedFile(null);

    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      let activeSessionId = sessionId;
      let s3Key = null;

      if (fileToUpload) {
        const uploaded = await uploadImage(
          fileToUpload,
          activeSessionId,
          (text) => updateAssistantMessage(assistantId, { text }),
          controller.signal,
        );
        s3Key = uploaded.s3Key;
        activeSessionId = uploaded.sessionId;
        if (activeSessionId) setSessionId(activeSessionId);
      }

      updateAssistantMessage(assistantId, {
        text: '🔍 유사 상품 검색 중...',
      });
      const data = await searchProducts(
        { message, s3Key, sessionId: activeSessionId },
        controller.signal,
      );
      const answer =
        data.answer ||
        (data.results.length ? '' : '유사한 상품을 찾지 못했습니다.');

      updateAssistantMessage(assistantId, {
        text: answer,
        status: 'success',
        results: data.results,
      });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        updateAssistantMessage(assistantId, {
          text: `요청 실패: ${errorMessage(error)}`,
          status: 'error',
          results: [],
        });
        console.error('쇼핑 검색 요청 중 오류가 발생했습니다.', error);
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      isSubmittingRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <h1>Shopping AI Assistant</h1>
      <ChatLog messages={messages} />
      <Composer
        messageInput={messageInput}
        selectedFile={selectedFile}
        previewUrl={previewUrl}
        isSubmitting={isSubmitting}
        onMessageChange={setMessageInput}
        onFileChange={setSelectedFile}
        onFileRemove={() => setSelectedFile(null)}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
