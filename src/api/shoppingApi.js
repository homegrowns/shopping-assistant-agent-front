// 이미지 업로드용 Presigned URL을 발급받는 기본 API 주소.
// VITE_API_BASE_URL이 설정되지 않았을 때 사용한다.
const DEFAULT_API_BASE =
  'https://70crv2wl9a.execute-api.ap-northeast-2.amazonaws.com/dev';
// 이미지 업로드 API 주소. 환경변수가 있으면 해당 값을 우선 사용한다.
// 마지막 슬래시는 `/products` 결합 시 이중 슬래시가 생기지 않도록 제거한다.
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ||
  DEFAULT_API_BASE;

// 상품 검색을 담당하는 FastAPI 주소.
// Vercel 대시보드의 VITE_SEARCH_API_BASE_URL 환경변수가 있으면 해당 주소를 사용하고,
// 값이 없으면(로컬 환경) 빈 문자열('')을 반환하여 Vite 프록시가 `/search`를 처리하도록 합니다.
export const searchApiBase =
  import.meta.env.VITE_SEARCH_API_BASE_URL?.trim().replace(/\/$/, '') || '';

// 환경변수가 있으면 절대 URL, 없으면 상대 URL이 된다.
export const SEARCH_ENDPOINT = `${searchApiBase || ''}/search?top_k=8`;

// 빈 응답이나 JSON이 아닌 응답도 안전하게 처리하기 위한 파싱 함수.
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// API 응답의 `error` 필드가 유효한 문자열일 때만 반환한다.
function serverMessage(data) {
  return typeof data?.error === 'string' && data.error.trim()
    ? data.error.trim()
    : null;
}

/**
 * 이미지 업로드에 필요한 Presigned URL과 S3 key를 발급받는다.
 *
 * @param {File} file 사용자가 선택한 이미지 파일
 * @param {string|null} sessionId 현재 검색 세션 ID
 * @param {AbortSignal} signal 요청 취소용 signal
 */
export async function requestPresignedUpload(file, sessionId, signal) {
  const response = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Presigned URL 생성 및 실제 PUT 요청의 Content-Type과 일치해야 한다.
      content_type: file.type,
      session_id: sessionId,
    }),
    signal,
  });
  const data = await readJson(response);

  // 4xx 또는 5xx 응답이면 서버 메시지를 우선 사용한다.
  if (!response.ok) {
    throw new Error(serverMessage(data) || 'Presigned URL 발급에 실패했습니다.');
  }
  // HTTP 상태는 성공이지만 응답 본문에 오류가 있는 경우도 처리한다.
  if (serverMessage(data)) {
    throw new Error(serverMessage(data));
  }
  // 다음 업로드 단계에 필요한 필수 필드를 방어적으로 검증한다.
  if (
    typeof data?.presigned_url !== 'string' ||
    !data.presigned_url ||
    typeof data?.s3_key !== 'string' ||
    !data.s3_key
  ) {
    throw new Error('이미지 업로드 정보를 확인할 수 없습니다.');
  }

  return data;
}

/**
 * Presigned URL을 이용해 브라우저에서 S3로 이미지를 직접 업로드한다.
 * 이미지 파일은 FastAPI 서버를 거치지 않는다.
 */
export async function putImage(file, presignedUrl, signal) {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      // Presigned URL 발급 시 전달한 파일 형식과 동일해야 한다.
      'Content-Type': file.type,
    },
    body: file,
    signal,
  });

  if (!response.ok) {
    throw new Error('S3 이미지 업로드에 실패했습니다.');
  }
}

/**
 * Presigned URL 발급과 S3 업로드를 순서대로 실행한다.
 * onStatus를 호출해 화면의 단계별 진행 문구를 갱신한다.
 */
export async function uploadImage(file, sessionId, onStatus, signal) {
  onStatus('📤 Presigned URL 발급 중...');
  const upload = await requestPresignedUpload(file, sessionId, signal);

  onStatus('📤 S3에 이미지 업로드 중...');
  await putImage(file, upload.presigned_url, signal);

  onStatus('✅ 이미지 업로드 완료! 검색 중...');
  return {
    // FastAPI 검색 요청이 S3 이미지를 찾을 때 사용하는 객체 key다.
    s3Key: upload.s3_key,
    // 새 세션이 발급되지 않았다면 기존 세션 ID를 유지한다.
    sessionId: upload.session_id || sessionId,
  };
}

/**
 * FastAPI 상품 검색 API를 호출한다.
 * 텍스트만, 이미지만, 텍스트와 이미지가 모두 있는 요청을 지원한다.
 */
export async function searchProducts(
  { message, s3Key, sessionId },
  signal,
) {
  const formData = new FormData();

  // FastAPI의 Form(...) 파라미터 이름과 정확히 일치해야 한다.
  // 세션이 아직 없더라도 필수 필드이므로 빈 문자열을 전달한다.
  formData.append('session_id', sessionId ?? '');

  // 선택 필드는 실제 값이 있을 때만 FormData에 포함한다.
  if (message) formData.append('message', message);
  if (s3Key) formData.append('s3_key', s3Key);

  // SEARCH_ENDPOINT가 상대 URL과 절대 URL인 경우를 모두 지원한다.
  const searchUrl = new URL(SEARCH_ENDPOINT, window.location.origin);
  const response = await fetch(searchUrl, {
    method: 'POST',
    // Content-Type은 직접 지정하지 않는다. 브라우저가 multipart boundary를 붙인다.
    body: formData,
    signal,
  });
  const data = await readJson(response);

  // FastAPI의 HTTP 오류 응답을 사용자에게 표시할 메시지로 변환한다.
  if (!response.ok) {
    throw new Error(
      serverMessage(data) ||
      `검색 서버 응답 오류 (상태 코드: ${response.status})`,
    );
  }
  if (serverMessage(data)) {
    throw new Error(serverMessage(data));
  }

  // 예상하지 못한 응답 형태가 와도 UI 렌더링이 중단되지 않도록 정규화한다.
  return {
    answer: typeof data?.answer === 'string' ? data.answer : '',
    results: Array.isArray(data?.results) ? data.results : [],
  };
}
