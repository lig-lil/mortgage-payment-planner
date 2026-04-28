import { PropsWithChildren, ReactNode } from 'react';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export const SectionCard = ({
  title,
  description,
  actions,
  children
}: SectionCardProps) => (
  <section className="section-card">
    <div className="section-card__header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="section-card__actions">{actions}</div> : null}
    </div>
    {children}
  </section>
);
