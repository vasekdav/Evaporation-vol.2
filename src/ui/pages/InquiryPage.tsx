import { useId } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import type { Evaluation } from '../../core/evaluate';
import { buildInquiry, checkInquiry, fieldValue, missingInquiryFields, type InquiryField } from '../../core/inquiry';
import { SourceTag } from '../components/Qty';

const SRC_LABEL: Record<InquiryField['source'], string> = {
  VSTUP: 'ze vstupů',
  VYPOCET: 'z výpočtu',
  PRAXE: 'praxe',
  DOPLNIT: 'doplnit',
};

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
      <span className="src src-DOPLNIT">DOPLNIT</span>
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
        <span className="muted small">{edited ? 'upraveno' : SRC_LABEL[f.source]}</span>
        {edited ? (
          <button type="button" className="link-btn small" onClick={onReset}>
            vrátit předvyplněné
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
        <h2>Poptávka pro výrobce</h2>
        <p className="note">
          Formulář je předvyplněný ze vstupů a výsledků výpočtu. Ke každé položce je uvedeno, proč ji výrobce potřebuje. Velikost
          a garanci určuje výrobce přepočtem na lokalitu – poptávka proto popisuje podmínky, ne model.
        </p>
        {toolbar}
        <div className={`status ${mism.length ? 'st-warn' : 'st-ok'}`} role="status" data-testid="inquiry-check">
          {mism.length
            ? `Poptávka se liší od vstupů výpočtu v ${mism.length} ${mism.length === 1 ? 'poli' : 'polích'}`
            : 'Svázaná pole poptávky odpovídají vstupům výpočtu'}
        </div>
        {mism.length ? (
          <ul className="mismatch">
            {mism.map((m) => (
              <li key={m.key}>
                <strong>{m.label}:</strong> ve formuláři „{m.actual}“, ze vstupů „{m.expected}“{' '}
                <button type="button" className="link-btn small" onClick={() => reset(m.key)}>
                  použít hodnotu ze vstupů
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {missing.length ? <p className="note">K doplnění zbývá {missing.length} polí (označena DOPLNIT).</p> : null}
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
              <div className="why-label">Proč to výrobce potřebuje</div>
              <p>{it.why}</p>
            </aside>
          </div>
        </section>
      ))}
    </div>
  );
}
