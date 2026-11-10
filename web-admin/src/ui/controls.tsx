import { useId, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  loading = false,
  block = false,
  small = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; loading?: boolean; block?: boolean; small?: boolean }) {
  const classes = ['btn', variant !== 'primary' && `btn-${variant}`, block && 'btn-block', small && 'btn-sm', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="spinner" aria-hidden style={{ width: 16, height: 16, borderWidth: 2 }} />}
      {children}
    </button>
  );
}

type FieldProps = { label: string; error?: string; hint?: string };

function Field({ id, label, error, hint, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="error-text" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function TextField({
  label, error, hint, className = '', ...rest
}: FieldProps & Omit<ComponentProps<'input'>, 'id'>) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        className={`input ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
    </Field>
  );
}

export function TextArea({
  label, error, hint, className = '', ...rest
}: FieldProps & Omit<ComponentProps<'textarea'>, 'id'>) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        className={`input ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
    </Field>
  );
}

export type Option = { value: string; label: string };

// Native select: accessible and keyboard friendly out of the box.
export function SelectField({
  label, error, hint, options, placeholder, ...rest
}: FieldProps & { options: Option[]; placeholder?: string } & Omit<ComponentProps<'select'>, 'id' | 'children'>) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({
  label, error, ...rest
}: { label: ReactNode; error?: string } & Omit<ComponentProps<'input'>, 'type'>) {
  const id = useId();
  return (
    <div className="field">
      <label className="checkbox" htmlFor={id}>
        <input id={id} type="checkbox" aria-invalid={error ? true : undefined} {...rest} />
        <span>{label}</span>
      </label>
      {error && <span className="error-text" role="alert">{error}</span>}
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export function Badge({ tone = 'info', children }: PropsWithChildren<{ tone?: Tone }>) {
  return <span className={`badge ${tone === 'info' ? '' : `badge-${tone}`}`}>{children}</span>;
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="toolbar">{actions}</div>}
    </header>
  );
}
