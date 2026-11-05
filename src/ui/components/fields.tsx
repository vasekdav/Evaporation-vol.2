import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { FieldText } from '../texts';

/** Čte číslo v CZ i EN zápisu: „−5,5“, „-5.5“, „1 000“. Prázdné → null, nečitelné → NaN. */
export function parseNumber(text: string): number | null {
  const t = text.replace(/[\s  ]/g, '').replace(/−/g, '-').replace(',', '.');
  if (t === '') return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return Number.NaN;
  return Number(t);
}

/** Hodnota do editačního pole: desetinná čárka, bez oddělovače tisíců, bez šumu plovoucí čárky. */
export function formatEditable(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '';
  return String(Number(v.toPrecision(10))).replace('.', ',');
}

export interface FieldIssue {
  level: 'CHYBA' | 'POZOR';
  text: string;
}

interface FieldProps {
  text: FieldText;
  children: ReactNode;
  hint?: ReactNode;
  /** nálezy kontrol vztažené k tomuto poli */
  issues?: readonly FieldIssue[];
  htmlFor?: string;
  id?: string;
}

/** Pole formuláře s popiskem a rozbalovací nápovědou „proč na tom záleží“ (funguje i dotykem). */
export function Field({ text, children, hint, issues = [], htmlFor, id }: FieldProps) {
  const [open, setOpen] = useState(false);
  const helpId = useId();
  const hasErr = issues.some((i) => i.level === 'CHYBA');
  return (
    <div id={id} className={`field${hasErr ? ' field-error' : issues.length ? ' field-warn' : ''}`}>
      <div className="field-head">
        <label htmlFor={htmlFor}>{text.label}</label>
        <button
          type="button"
          className="help-btn"
          aria-expanded={open}
          aria-controls={helpId}
          aria-label={`Proč na tom záleží: ${text.label}`}
          onClick={() => setOpen((o) => !o)}
        >
          ?
        </button>
      </div>
      {children}
      {hint ? <div className="hint" data-narrative="">{hint}</div> : null}
      {issues.length ? (
        <ul className="field-issues" id={htmlFor ? `${htmlFor}-issues` : undefined} data-narrative="">
          {issues.map((i) => (
            <li key={i.text} className={i.level === 'CHYBA' ? 'err' : 'warn'}>
              {i.text}
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <div id={helpId} className="help" data-narrative="">
          <strong>Proč na tom záleží: </strong>
          {text.help}
        </div>
      ) : null}
    </div>
  );
}

interface NumberInputProps {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit: string;
  /** povolit prázdné pole (null = nezadáno) */
  optional?: boolean;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** nález kontroly vztažený k poli (zvýrazní pole) */
  flagged?: boolean;
}

/** Číselné pole s jednotkou. Drží vlastní text, aby šlo psát „-“ nebo „5,“ bez přepisování. */
export function NumberInput({ id, value, onChange, unit, optional, placeholder, disabled, ariaLabel, flagged }: NumberInputProps) {
  const [text, setText] = useState(formatEditable(value));
  useEffect(() => {
    const parsed = parseNumber(text);
    const same = parsed === value || (parsed !== null && value !== null && Number.isNaN(parsed) && Number.isNaN(value));
    if (!same) setText(formatEditable(value));
  }, [value]);
  const parsed = parseNumber(text);
  const unreadable = parsed !== null && Number.isNaN(parsed);
  const invalid = (parsed === null && !optional) || unreadable || !!flagged;
  const hintId = id ? `${id}-num` : undefined;
  return (
    <>
    <div className="num-input">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder={placeholder ?? (optional ? 'nezadáno' : '')}
        disabled={disabled}
        aria-invalid={invalid}
        aria-label={ariaLabel}
        aria-describedby={id ? [unreadable || (parsed === null && !optional) ? hintId : null, `${id}-issues`].filter(Boolean).join(' ') : undefined}
        onChange={(e) => {
          setText(e.target.value);
          const p = parseNumber(e.target.value);
          onChange(p === null ? (optional ? null : Number.NaN) : p);
        }}
      />
      <span className="unit">{unit}</span>
    </div>
    {unreadable || (parsed === null && !optional) ? (
      <div className="hint err" id={hintId} data-narrative="">
        {unreadable ? 'Zadej číslo, např. 1 000 nebo 1,5 (záporné −30).' : 'Pole je povinné.'}
      </div>
    ) : null}
    </>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}

/** Přepínač (radiogroup) s klávesnicí: jedna zarážka tabulátoru, šipky mění volbu. */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: SegmentedProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length]!;
    onChange(next.value);
    const btns = ref.current?.querySelectorAll<HTMLButtonElement>('button');
    btns?.[options.indexOf(next)]?.focus();
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel} ref={ref} onKeyDown={onKey}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
