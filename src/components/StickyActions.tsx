interface StickyActionsProps {
  title?: string;
  onExportScheduleCsv: () => void;
  onExportResultsCsv: () => void;
  onClearData: () => void;
  note: string;
}

export const StickyActions = ({
  title = 'Offline ready',
  onExportScheduleCsv,
  onExportResultsCsv,
  onClearData,
  note
}: StickyActionsProps) => (
  <div className="sticky-actions">
    <div>
      <strong>{title}</strong>
      <p>{note}</p>
    </div>
    <div className="sticky-actions__buttons">
      <button type="button" className="secondary-button" onClick={onExportScheduleCsv}>
        Export schedule CSV
      </button>
      <button type="button" className="secondary-button" onClick={onExportResultsCsv}>
        Export results CSV
      </button>
      <button type="button" className="danger-button" onClick={onClearData}>
        Clear local data
      </button>
    </div>
  </div>
);
