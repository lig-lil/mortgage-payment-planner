import { ChangeEvent, useRef } from 'react';
import { ExtractionMeta } from '../types';
import { SectionCard } from './SectionCard';

interface UploadCardProps {
  title: string;
  meta: ExtractionMeta | null;
  rowCount: number;
  isParsing: boolean;
  onSelectPdf: (file: File) => void;
}

export const UploadCard = ({
  title,
  meta,
  rowCount,
  isParsing,
  onSelectPdf
}: UploadCardProps) => {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const handlePdfChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectPdf(file);
    }
    event.target.value = '';
  };

  return (
    <SectionCard title={title}>
      <div className="upload-card">
        <div className="upload-card__dropzone">
          <span className="upload-card__file-icon" aria-hidden="true">PDF</span>
          <div className="upload-card__file-details">
            <strong>{meta?.sourceFileName ?? 'No PDF uploaded yet'}</strong>
            <span>
              {meta
                ? `${rowCount} rows · ${meta.parsedPages} pages · ${Math.round((meta.creditColumn.confidence || 0) * 100)}% confidence`
                : "Upload your bank's repayment schedule."}
            </span>
          </div>
          <button
            type="button"
            className="secondary-button upload-card__replace"
            onClick={() => pdfInputRef.current?.click()}
            disabled={isParsing}
          >
            {isParsing ? 'Processing...' : meta ? 'Replace' : 'Choose PDF'}
          </button>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={handlePdfChange}
          />
        </div>
      </div>
    </SectionCard>
  );
};
