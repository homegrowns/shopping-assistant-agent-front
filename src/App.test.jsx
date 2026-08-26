import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import App from './App.jsx';
import { API_BASE } from './api/shoppingApi.js';
import { axe } from './test/setup.js';
import { server } from './test/server.js';

const SEARCH_URL = 'http://localhost:3000/search';
const UPLOAD_URL = 'https://upload.example.test/product.jpg';

function searchResult(overrides = {}) {
  return {
    id: 'product-1',
    title: '검은 운동화',
    image_url: 'https://images.example.test/product.jpg',
    hprice: '120000',
    lprice: '89000',
    mall_name: '예시몰',
    link: 'https://shop.example.test/products/1',
    ...overrides,
  };
}

function mockSuccessfulSearch(payload = {}) {
  let requestCount = 0;
  let submittedForm = null;

  server.use(
    http.post(SEARCH_URL, async ({ request }) => {
      requestCount += 1;
      submittedForm = await request.formData();
      return HttpResponse.json({
        answer: '추천 상품을 찾았습니다.',
        results: [searchResult()],
        ...payload,
      });
    }),
  );

  return {
    get count() {
      return requestCount;
    },
    get form() {
      return submittedForm;
    },
  };
}

async function submitText(user, text = '검은 운동화') {
  await user.type(screen.getByLabelText('상품 검색 내용'), text);
  await user.click(screen.getByRole('button', { name: '검색' }));
}

describe('Shopping AI Assistant', () => {
  test('renders the preserved shell with no detectable accessibility violations', async () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Shopping AI Assistant' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('log', { name: '쇼핑 검색 대화' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이미지 첨부' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '검색' })).toBeEnabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('does not request a search when both inputs are empty', async () => {
    const user = userEvent.setup();
    const search = mockSuccessfulSearch();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(search.count).toBe(0);
    expect(screen.queryByText('🔍 유사 상품 검색 중...')).not.toBeInTheDocument();
  });

  test('submits text, renders a safe product card, and prevents duplicate requests', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    let submittedForm;
    server.use(
      http.post(SEARCH_URL, async ({ request }) => {
        requestCount += 1;
        submittedForm = await request.formData();
        await delay(80);
        return HttpResponse.json({
          answer: '추천 상품을 찾았습니다.',
          results: [searchResult()],
        });
      }),
    );
    const { container } = render(<App />);

    await submitText(user);
    const sendButton = screen.getByRole('button', { name: '검색' });
    expect(sendButton).toBeDisabled();
    await user.click(sendButton);

    expect(await screen.findByText('추천 상품을 찾았습니다.')).toBeInTheDocument();
    expect(requestCount).toBe(1);
    expect(submittedForm.get('session_id')).toBe('');
    expect(submittedForm.get('message')).toBe('검은 운동화');
    expect(submittedForm.has('s3_key')).toBe(false);
    expect(sendButton).toBeEnabled();

    const productLink = screen.getByRole('link', {
      name: '검은 운동화 상품 보기',
    });
    expect(productLink).toHaveAttribute(
      'href',
      'https://shop.example.test/products/1',
    );
    expect(productLink).toHaveAttribute('target', '_blank');
    expect(productLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('최고가: 120000')).toBeInTheDocument();
    expect(screen.getByText('최저가: 89000')).toBeInTheDocument();
    expect(screen.getByText('판매처: 예시몰')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('uploads image and text before searching with the returned session and S3 key', async () => {
    const user = userEvent.setup();
    const requests = { searches: [] };
    server.use(
      http.post(`${API_BASE}/products`, async ({ request }) => {
        requests.presign = await request.json();
        return HttpResponse.json({
          session_id: 'session-123',
          presigned_url: UPLOAD_URL,
          s3_key: 'uploads/product.jpg',
        });
      }),
      http.put(UPLOAD_URL, async ({ request }) => {
        requests.uploadContentType = request.headers.get('content-type');
        requests.uploadSize = (await request.arrayBuffer()).byteLength;
        return new HttpResponse(null, { status: 200 });
      }),
      http.post(SEARCH_URL, async ({ request }) => {
        requests.searches.push(await request.formData());
        return HttpResponse.json({
          answer:
            requests.searches.length === 1
              ? '이미지 검색 완료'
              : '후속 검색 완료',
          results: [],
        });
      }),
    );
    const { unmount } = render(<App />);
    const file = new File(['image-content'], 'shoe.png', { type: 'image/png' });

    await user.upload(screen.getByLabelText('상품 이미지 선택'), file);
    expect(
      await screen.findByRole('img', { name: '선택한 이미지: shoe.png' }),
    ).toHaveAttribute('src', 'blob:mock-1');
    await user.type(screen.getByLabelText('상품 검색 내용'), '이와 비슷한 상품');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(await screen.findByText('이미지 검색 완료')).toBeInTheDocument();
    expect(requests.presign).toEqual({
      content_type: 'image/png',
      session_id: null,
    });
    expect(requests.uploadContentType).toBe('image/png');
    expect(requests.uploadSize).toBeGreaterThan(0);
    expect(requests.searches[0].get('session_id')).toBe('session-123');
    expect(requests.searches[0].get('message')).toBe('이와 비슷한 상품');
    expect(requests.searches[0].get('s3_key')).toBe('uploads/product.jpg');
    expect(screen.getByAltText('첨부한 상품 이미지')).toBeInTheDocument();

    await user.type(screen.getByLabelText('상품 검색 내용'), '후속 질문');
    await user.click(screen.getByRole('button', { name: '검색' }));
    expect(await screen.findByText('후속 검색 완료')).toBeInTheDocument();
    expect(requests.searches[1].get('session_id')).toBe('session-123');
    expect(requests.searches[1].get('message')).toBe('후속 질문');
    expect(requests.searches[1].has('s3_key')).toBe(false);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-2');
  });

  test('submits an image without text', async () => {
    const user = userEvent.setup();
    let searchForm;
    server.use(
      http.post(`${API_BASE}/products`, () =>
        HttpResponse.json({
          session_id: 'image-session',
          presigned_url: UPLOAD_URL,
          s3_key: 'uploads/image-only.jpg',
        }),
      ),
      http.put(UPLOAD_URL, () => new HttpResponse(null, { status: 200 })),
      http.post(SEARCH_URL, async ({ request }) => {
        searchForm = await request.formData();
        return HttpResponse.json({ answer: '이미지만으로 검색했습니다.', results: [] });
      }),
    );
    render(<App />);

    await user.upload(
      screen.getByLabelText('상품 이미지 선택'),
      new File(['image'], 'bag.jpg', { type: 'image/jpeg' }),
    );
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(await screen.findByText('이미지만으로 검색했습니다.')).toBeInTheDocument();
    expect(searchForm.has('message')).toBe(false);
    expect(searchForm.get('s3_key')).toBe('uploads/image-only.jpg');
  });

  test('removes, replaces, and reselects files while revoking every preview URL', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText('상품 이미지 선택');
    const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
    const secondFile = new File(['second'], 'second.png', { type: 'image/png' });

    await user.upload(input, firstFile);
    expect(await screen.findByAltText('선택한 이미지: first.png')).toBeInTheDocument();
    await user.upload(input, secondFile);
    expect(await screen.findByAltText('선택한 이미지: second.png')).toBeInTheDocument();
    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1'),
    );

    await user.click(screen.getByRole('button', { name: '첨부 이미지 삭제' }));
    expect(screen.queryByAltText('선택한 이미지: second.png')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-2'),
    );

    await user.upload(input, secondFile);
    expect(await screen.findByAltText('선택한 이미지: second.png')).toBeInTheDocument();
  });

  test('uses Enter to submit, Shift+Enter for a newline, and ignores Enter during IME composition', async () => {
    const user = userEvent.setup();
    const search = mockSuccessfulSearch({ results: [] });
    render(<App />);
    const textarea = screen.getByLabelText('상품 검색 내용');

    await user.type(textarea, '한글 검색');
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    expect(search.count).toBe(0);
    fireEvent.compositionEnd(textarea);

    await user.keyboard('{Shift>}{Enter}{/Shift}두 번째 줄');
    expect(textarea).toHaveValue('한글 검색\n두 번째 줄');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('추천 상품을 찾았습니다.')).toBeInTheDocument();
    expect(search.count).toBe(1);
    expect(search.form.get('message').replace(/\r\n/g, '\n')).toBe(
      '한글 검색\n두 번째 줄',
    );
  });

  test('shows the empty-result message when answer and results are empty', async () => {
    const user = userEvent.setup();
    mockSuccessfulSearch({ answer: '', results: [] });
    render(<App />);

    await submitText(user, '존재하지 않는 상품');

    expect(
      await screen.findByText('유사한 상품을 찾지 못했습니다.'),
    ).toBeInTheDocument();
  });

  test('normalizes a missing results field without crashing', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(SEARCH_URL, () => HttpResponse.json({ answer: '대화 응답입니다.' })),
    );
    render(<App />);

    await submitText(user, '안녕하세요');

    expect(await screen.findByText('대화 응답입니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('상품 검색 결과')).not.toBeInTheDocument();
  });

  test.each([
    {
      name: 'presigned request',
      handlers: [
        http.post(`${API_BASE}/products`, () =>
          HttpResponse.json({ error: '업로드 권한이 없습니다.' }, { status: 403 }),
        ),
      ],
      file: true,
      expected: '요청 실패: 업로드 권한이 없습니다.',
    },
    {
      name: 'S3 upload',
      handlers: [
        http.post(`${API_BASE}/products`, () =>
          HttpResponse.json({
            session_id: 'session',
            presigned_url: UPLOAD_URL,
            s3_key: 'key',
          }),
        ),
        http.put(UPLOAD_URL, () => new HttpResponse(null, { status: 500 })),
      ],
      file: true,
      expected: '요청 실패: S3 이미지 업로드에 실패했습니다.',
    },
    {
      name: 'search HTTP response',
      handlers: [
        http.post(SEARCH_URL, () => new HttpResponse(null, { status: 503 })),
      ],
      file: false,
      expected: '요청 실패: 검색 서버 응답 오류 (상태 코드: 503)',
    },
    {
      name: 'search error payload',
      handlers: [
        http.post(SEARCH_URL, () =>
          HttpResponse.json({ error: '검색 조건이 올바르지 않습니다.' }),
        ),
      ],
      file: false,
      expected: '요청 실패: 검색 조건이 올바르지 않습니다.',
    },
  ])('shows a Korean user-facing error for $name failures', async ({ handlers, file, expected }) => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(...handlers);
    render(<App />);

    try {
      if (file) {
        await user.upload(
          screen.getByLabelText('상품 이미지 선택'),
          new File(['image'], 'error.png', { type: 'image/png' }),
        );
      } else {
        await user.type(screen.getByLabelText('상품 검색 내용'), '오류 테스트');
      }
      await user.click(screen.getByRole('button', { name: '검색' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
      expect(screen.getByRole('button', { name: '검색' })).toBeEnabled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test('does not make an invalid product link interactive and handles an image error', async () => {
    const user = userEvent.setup();
    mockSuccessfulSearch({
      results: [
        searchResult({
          id: 'unsafe-product',
          link: 'javascript:alert(1)',
          hprice: null,
          lprice: '',
        }),
      ],
    });
    render(<App />);

    await submitText(user);
    await screen.findByText('추천 상품을 찾았습니다.');

    expect(
      screen.queryByRole('link', { name: '검은 운동화 상품 보기' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('최고가: ??')).toBeInTheDocument();
    expect(screen.getByText('최저가: ??')).toBeInTheDocument();
    const image = screen.getByAltText('검은 운동화 상품 이미지');
    fireEvent.error(image);
    expect(image).toHaveClass('image-load-error');
  });
});
