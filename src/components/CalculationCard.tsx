import { FormEvent } from 'react';
import { SectionCard } from './SectionCard';

interface CalculationCardProps {
  title: string;
  inputLabel: string;
  inputPlaceholder: string;
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
  value,
  helperText,
  buttonLabel,
  error,
  onValueChange,
  onSubmit
}: CalculationCardProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <SectionCard title={title}>
      <form className="calc-card" onSubmit={handleSubmit}>
        <label className="field">
          <span>{inputLabel}</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder={inputPlaceholder}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          />
        </label>
        <p className="hint-text">{helperText}</p>
        {error ? <div className="inline-error">{error}</div> : null}
        <button type="submit" className="primary-button">
          {buttonLabel}
        </button>
      </form>
    </SectionCard>
  );
};
