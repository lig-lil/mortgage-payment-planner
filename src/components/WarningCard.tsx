import { AppWarning } from '../types';
import { SectionCard } from './SectionCard';

interface WarningCardProps {
  title: string;
  warnings: AppWarning[];
}

export const WarningCard = ({ title, warnings }: WarningCardProps) => {
  if (!warnings.length) {
    return null;
  }

  return (
    <SectionCard title={title}>
      <div className="warning-list">
        {warnings.map((warning) => (
          <div
            key={warning.id}
            className={`warning-list__item warning-list__item--${warning.severity}`}
          >
            {warning.message}
          </div>
        ))}
      </div>
    </SectionCard>
  );
};
