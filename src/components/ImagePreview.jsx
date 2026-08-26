import { useState } from 'react';

export default function ImagePreview({ file, previewUrl, onRemove }) {
  const [hasLoadError, setHasLoadError] = useState(false);

  if (!file || !previewUrl) return null;

  return (
    <div className="preview-row" aria-label="첨부 이미지 미리보기">
      <div className="preview-thumb">
        <img
          className={hasLoadError ? 'image-load-error' : undefined}
          src={previewUrl}
          alt={`선택한 이미지: ${file.name}`}
          onError={() => setHasLoadError(true)}
        />
        <button
          type="button"
          aria-label="첨부 이미지 삭제"
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </div>
  );
}
