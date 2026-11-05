import { useId } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import type { Evaluation } from '../../core/evaluate';
import { buildInquiry, checkInquiry, fieldValue, missingInquiryFields, type InquiryField } from '../../core/inquiry';
import { SourceTag } from '../components/Qty';
import { tr } from '../../core/i18n';

const srcLabel = (s: InquiryField['source']): string =>
  ({
    VSTUP: tr('ze vstupů', 'from inputs'),
    VYPOCET: tr('z výpočtu', 'from calculation'),
    PRAXE: tr('praxe', 'practice'),
    DOPLNIT: tr('doplnit', 'to fill in'),
  })[s];

function FieldEditor({
  f,
  value,
  edited,
  onChange,
  onReset,
}: {
  f: InquiryField;
  value: string;
  edited: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const id = useId();
  const tag =
    f.source === 'DOPLNIT' ? (
      <span className="src src-DOPLNIT">{tr('DOPLNIT', 'TO FILL')}</span>
    ) : f.source === 'VYPOCET' ? (
      <SourceTag src="VYPOCET" />
    ) : f.source === 'PRAXE' ? (
      <SourceTag src="PRAXE" />
    ) : (
      <SourceTag src="VSTUP" />
    );
  return (
    <div className={`inq-field${f.source === 'DOPLNIT' && value.trim() === '' ? ' todo' : ''}`}>
      <div className="inq-field-head">
        <label htmlFor={id}>{f.label}</label>
        {tag}
        <span className="muted small">{edited ? tr('upraveno', 'edited') : srcLabel(f.source)}</span>
        {edited ? (
          <button type="button" className="link-btn small" onClick={onReset}>
            {tr('vrátit předvyplněné', 'restore prefilled')}
          </button>
        ) : null}
      </div>
      {f.multiline || value.length > 60 || f.prefill.length > 60 ? (
        <textarea
          id={id}
          className="text-input"
          rows={Math.min(6, Math.max(2, Math.ceil(Math.max(value.length, f.prefill.length) / 70)))}
          value={value}
          aria-describedby={f.hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="text-input"
          value={value}
          aria-describedby={f.hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {f.hint ? (
        <div className="hint" id={`${id}-hint`}>
          {f.hint}
        </div>
      ) : null}
    </div>
  );
}

interface Props {
  ev: Evaluation;
  basis: CatalogBasis | undefined;
  overrides: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  toolbar: React.ReactNode;
}

/** Generátor poptávky pro výrobce (kap. 8 bod 8). */
export function InquiryPage({ ev, basis, overrides, onChange, toolbar }: Props) {
  const items = buildInquiry(ev, basis);
  const mism = checkInquiry(items, overrides);
  const missing = missingInquiryFields(items, overrides);
  const set = (k: string, v: string) => onChange({ ...overrides, [k]: v });
  const reset = (k: string) => {
    const next = { ...overrides };
    delete next[k];
    onChange(next);
  };

  return (
    <div className="inquiry">
      <section className="card">
        <h2>{tr('Poptávka pro výrobce', 'Enquiry for the manufacturer')}</h2>
        <p className="note">
          {tr(
            'Formulář je předvyplněný ze vstupů a výsledků výpočtu. Ke každé položce je uvedeno, proč ji výrobce potřebuje. Velikost a garanci určuje výrobce přepočtem na lokalitu – poptávka proto popisuje podmínky, ne model.',
            'The form is prefilled from the inputs and calculation results. Each item states why the manufacturer needs it. The size and guarantee are set by the manufacturer recalculating for the site – the enquiry therefore describes conditions, not a model.',
          )}
        </p>
        {toolbar}
        <div className={`status ${mism.length ? 'st-warn' : 'st-ok'}`} role="status" data-testid="inquiry-check">
          {mism.length
            ? tr(
                `Poptávka se liší od vstupů výpočtu v ${mism.length} ${mism.length === 1 ? 'poli' : 'polích'}`,
                `The enquiry differs from the calculation inputs in ${mism.length} ${mism.length === 1 ? 'field' : 'fields'}`,
              )
            : tr('Svázaná pole poptávky odpovídají vstupům výpočtu', 'Linked enquiry fields match the calculation inputs')}
        </div>
        {mism.length ? (
          <ul className="mismatch">
            {mism.map((m) => (
              <li key={m.key}>
                <strong>{m.label}:</strong> {tr('ve formuláři', 'in the form')} „{m.actual}“, {tr('ze vstupů', 'from inputs')} „{m.expected}“{' '}
                <button type="button" className="link-btn small" onClick={() => reset(m.key)}>
                  {tr('použít hodnotu ze vstupů', 'use the input value')}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {missing.length ? (
          <p className="note">
            {tr(`K doplnění zbývá ${missing.length} polí (označena DOPLNIT).`, `${missing.length} fields remain to be filled in (marked TO FILL).`)}
          </p>
        ) : null}
      </section>
      {items.map((it) => (
        <section className="card inq-item" key={it.id} aria-labelledby={`inq-${it.id}`}>
          <div className="inq-grid">
            <div>
              <h3 id={`inq-${it.id}`}>{it.title}</h3>
              {it.fields.map((f) => (
                <FieldEditor
                  key={f.key}
                  f={f}
                  value={fieldValue(f, overrides)}
                  edited={overrides[f.key] !== undefined}
                  onChange={(v) => set(f.key, v)}
                  onReset={() => reset(f.key)}
                />
              ))}
            </div>
            <aside className="why-box">
              <div className="why-label">{tr('Proč to výrobce potřebuje', 'Why the manufacturer needs it')}</div>
              <p>{it.why}</p>
            </aside>
          </div>
        </section>
      ))}
    </div>
  );
}
