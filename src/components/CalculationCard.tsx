import { FormEvent, useRef } from 'react';
import { parseFlexibleNumber } from '../utils/number';
import { SectionCard } from './SectionCard';

interface CalculationCardProps {
  title: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputPrefix?: string;
  shortcuts?: Array<{ label: string; value: number }>;
  value: string;
  helperText: string;
  buttonLabel: string;
  error: string | null;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
}

export const CalculationCard = ({
  title,
  inputLabel,
  inputPlaceholder,
  inputPrefix,
  shortcuts,
  value,
  helperText,
  buttonLabel,
  error,
  onValueChange,
  onSubmit
}: CalculationCardProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <SectionCard title={title}>
      <form className="calc-card" onSubmit={handleSubmit}>
        <label className="field">
          <span>{inputLabel}</span>
          <div className="calculation-input">
            {inputPrefix ? <span>{inputPrefix}</span> : null}
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              placeholder={inputPlaceholder}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
            />
          </div>
        </label>
        <p className="hint-text">{helperText}</p>
        {error ? <div className="inline-error">{error}</div> : null}
        {shortcuts?.length ? (
          <div className="calculation-shortcuts">
            <span className="planner-label">Shortcuts</span>
            <div>
              {shortcuts.map((shortcut) => (
                <button
                  key={shortcut.value}
                  type="button"
                  className={parseFlexibleNumber(value) === shortcut.value ? 'is-active' : ''}
                  onClick={() => onValueChange(String(shortcut.value))}
                >
                  {shortcut.label}
                </button>
              ))}
              <button type="button" onClick={() => inputRef.current?.focus()}>+ Custom</button>
            </div>
          </div>
        ) : null}
        <button type="submit" className="primary-button">
          {buttonLabel}
        </button>
      </form>
    </SectionCard>
  );
};
