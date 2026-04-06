import Link from 'next/link';
import type { ReactNode } from 'react';

type HeaderAction = {
  href: string;
  label: string;
  variant?: 'primary' | 'secondary';
};

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  actions?: HeaderAction[];
  meta?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions = [], meta }: PageHeaderProps) {
  return (
    <section className="heroPanel pageHero">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <div className="pageHeaderCopy">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="pageTitle">{title}</h1>
          <div className="subtle pageDescription">{description}</div>
        </div>
        <div className="pageHeaderAside">
          {meta ? <div className="pageMeta">{meta}</div> : null}
          {actions.length ? (
            <div className="buttonRow">
              {actions.map((action) => (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className={action.variant === 'secondary' ? 'secondaryButton' : 'primaryButton'}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: ReactNode;
  note: ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'review';
};

export function MetricCard({ label, value, note, tone = 'default' }: MetricCardProps) {
  return (
    <section className={`panel metricPanel metricPanel-${tone}`}>
      <div>
        <div className="kpiTitle">{label}</div>
        <div className="kpiValue">{value}</div>
      </div>
      <div className="metricNote">{note}</div>
    </section>
  );
}

type FilterSummaryProps = {
  heading: string;
  detail: ReactNode;
};

export function FilterSummary({ heading, detail }: FilterSummaryProps) {
  return (
    <div className="filterSummary">
      <strong>{heading}</strong>
      <span>{detail}</span>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  detail: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, detail, action }: EmptyStateProps) {
  return (
    <div className="emptyState">
      <div className="emptyStateTitle">{title}</div>
      <div className="emptyStateBody">{detail}</div>
      {action ? <div className="emptyStateAction">{action}</div> : null}
    </div>
  );
}
