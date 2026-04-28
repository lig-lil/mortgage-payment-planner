interface StickyActionsProps {
  onExportJson: () => void;
  onClearData: () => void;
  note: string;
}

export const StickyActions = ({
  onExportJson,
  onClearData,
  note
}: StickyActionsProps) => (
  <div className="sticky-actions">
    <div>
      <strong>Offline ready</strong>
      <p>{note}</p>
    </div>
    <div className="sticky-actions__buttons">
      <button type="button" className="secondary-button" onClick={onExportJson}>
        Export JSON
      </button>
      <button type="button" className="danger-button" onClick={onClearData}>
        Clear local data
      </button>
    </div>
  </div>
);
