import { useEffect, useRef, useState } from 'react';
import { streamSearchProducts, uploadImage } from './api/shoppingApi.js';
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

      await streamSearchProducts(
        { message, s3Key, sessionId: activeSessionId },
        {
          onStatus: (status) => {
            // 백엔드에서 상태가 바뀔 때마다 실행됨 ("🤖 질문 분석 중...", "🔍 상품 검색 중..." 등)
            console.log('[UI onStatus 호출]', status);
            updateAssistantMessage(assistantId, {
              text: loadingStatusText(status),
              status: 'loading',
            });
          },
          onToken: (token) => {
            // LLM 답변이 한 글자씩 올 때마다 실행됨
            console.log('[UI onToken 호출]', token);
            streamedAnswer += token;

            // 누적된 전체 답변으로 기존 Assistant 메시지를 계속 갱신한다.
            // 이 과정 때문에 사용자 화면에서는
            // ChatGPT처럼 답변이 실시간으로 생성되는 것처럼 보인다.
            //
            // 이전에 onStatus가 표시한
            // "🔍 상품 검색 중..." 같은 문구는
            // 첫 token이 도착하는 순간 실제 LLM 답변으로 교체된다.
            updateAssistantMessage(assistantId, {
              text: streamedAnswer,
              status: 'streaming',
            });
          },

          onResults: (results) => {
            console.log('[UI onResults 호출]', results);
            // 백엔드의 검색/LLM 처리가 모두 끝나고
            // 최종 상품 검색 결과가 전달될 때 한 번 호출된다.
            //
            // results 예:
            // [
            //   {
            //     product_id: 343,
            //     title: "...",
            //     image_url: "...",
            //     price: 51300
            //   },
            //   ...
            // ]

            updateAssistantMessage(assistantId, {
              // LLM이 실제 답변을 스트리밍했다면
              // 그동안 누적한 최종 streamedAnswer를 그대로 유지한다.
              //
              // 만약 streamedAnswer가 비어 있다면:
              // - 상품이 존재하면 빈 문자열 유지
              //   → 상품 카드만 보여줄 수 있음
              // - 상품도 없다면 사용자에게 검색 실패 문구를 보여준다.
              text:
                streamedAnswer ||
                (results.length
                  ? ''
                  : '유사한 상품을 찾지 못했습니다.'),

              // 현재 Assistant 메시지의 처리가 끝났음을 표시한다.
              // UI에서 loading spinner 제거 등에 사용할 수 있다.
              status: 'success',

              // 최종 상품 데이터를 Assistant 메시지에 저장한다.
              // React 렌더링 단계에서 이 값을 이용해 상품 카드를 표시한다.
              results,
            });
          },
        },

        // 3) 요청 취소를 위한 AbortSignal
        //
        // 사용자가 새 검색을 시작하거나,
        // 페이지를 이동하거나,
        // 직접 취소했을 때 현재 fetch/stream 연결을 종료하는 데 사용한다.
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
