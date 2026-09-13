import { useEffect, useRef, useState } from 'react';
import { streamSearchProducts, uploadImage } from './api/shoppingApi.js';
import ChatLog from './components/ChatLog.jsx';
import Brand from './components/Brand.jsx';
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

function loadingStatusText(status) {
  return typeof status === 'string'
    ? status.replace(/[.…]+\s*$/, '').trimEnd()
    : '';
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
      text: fileToUpload ? '📤 업로드 준비 중' : '🔍 유사 상품 검색 중',
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
          (text) => updateAssistantMessage(assistantId, {
            text: loadingStatusText(text),
            status: 'loading',
          }),
          controller.signal,
        );
        s3Key = uploaded.s3Key;
        activeSessionId = uploaded.sessionId;
        if (activeSessionId) setSessionId(activeSessionId);
      }

      updateAssistantMessage(assistantId, {
        text: '🔍 유사 상품 검색 중',
        status: 'loading',
      });

      let streamedAnswer = '';
      let hasStartedStreaming = false;

      await streamSearchProducts(
        { message, s3Key, sessionId: activeSessionId },
        {
          onStatus: (status) => {
            console.log('[UI onStatus 호출]', status);

            // 이미 LLM 답변 스트리밍이 시작된 뒤에는
            // 상태 메시지가 실제 답변을 덮어쓰지 않도록 한다.
            if (hasStartedStreaming) {
              return;
            }

            updateAssistantMessage(assistantId, {
              text: loadingStatusText(status),
              status: 'loading',
            });
          },

          onToken: (token) => {
            console.log('[UI onToken 호출]', token);

            hasStartedStreaming = true;

            // 실제 LLM delta token을 계속 누적
            streamedAnswer += token;

            updateAssistantMessage(assistantId, {
              text: streamedAnswer,
              status: 'streaming',
            });
          },

          // --------------------------------------------------
          // 백엔드의 done 이벤트가 도착했을 때 실행
          // --------------------------------------------------
          onDone: (answer) => {
            console.log('[UI onDone 호출]', answer);

            // 백엔드에서 최종 완성된 답변을 보내줬다면
            // 지금까지 append한 내용을 최종 answer로 통째로 교체
            if (typeof answer === 'string' && answer.trim()) {
              streamedAnswer = answer;
            }

            updateAssistantMessage(assistantId, {
              text: streamedAnswer,
              status: 'streaming',
            });
          },

          onResults: (results) => {
            console.log('[UI onResults 호출]', results);

            updateAssistantMessage(assistantId, {
              text:
                streamedAnswer ||
                (results.length
                  ? ''
                  : '유사한 상품을 찾지 못했습니다.'),

              status: 'success',

              results,
            });
          },
        },

        controller.signal,
      );


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
      <h1 className="app-title"><Brand /></h1>
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
