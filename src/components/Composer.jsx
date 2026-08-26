import { useEffect, useRef } from 'react';
import ImagePreview from './ImagePreview.jsx';

export default function Composer({
  messageInput,
  selectedFile,
  previewUrl,
  isSubmitting,
  onMessageChange,
  onFileChange,
  onFileRemove,
  onSubmit,
}) {
  const fileInputRef = useRef(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (!selectedFile && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedFile]);

  function removeFile() {
    if (fileInputRef.current) fileInputRef.current.value = '';
    onFileRemove();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    onFileChange(file);
  }

  function handleKeyDown(event) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !isComposingRef.current
    ) {
      event.preventDefault();
      onSubmit();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <>
      <ImagePreview
        key={previewUrl || 'empty-preview'}
        file={selectedFile}
        previewUrl={previewUrl}
        onRemove={removeFile}
      />
      <form className="composer" onSubmit={handleSubmit}>
        <button
          className="attach-button"
          type="button"
          aria-label="이미지 첨부"
          title="이미지 첨부"
          onClick={() => fileInputRef.current?.click()}
        >
          <span aria-hidden="true">📎</span>
        </button>
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept="image/*"
          aria-label="상품 이미지 선택"
          onChange={handleFileChange}
        />
        <label className="visually-hidden" htmlFor="message-input">
          상품 검색 내용
        </label>
        <textarea
          id="message-input"
          className="message-input"
          rows="1"
          placeholder="찾고 싶은 상품을 설명하거나, 이미지를 첨부해보세요"
          value={messageInput}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
        />
        <button className="send-button" type="submit" disabled={isSubmitting}>
          검색
        </button>
      </form>
    </>
  );
}
