import { ChangeEvent, useRef } from 'react';
import { SectionCard } from './SectionCard';

interface UploadCardProps {
  title: string;
  description: string;
  sourceFileName: string | null;
  isParsing: boolean;
  onSelectPdf: (file: File) => void;
}

export const UploadCard = ({
  title,
  description,
  sourceFileName,
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
    <SectionCard title={title} description={description}>
      <div className="upload-card">
        <div className="upload-card__dropzone">
          <p>{sourceFileName ? `Last file: ${sourceFileName}` : 'No PDF uploaded yet.'}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={isParsing}
          >
            {isParsing ? 'Processing PDF...' : 'Choose PDF'}
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
