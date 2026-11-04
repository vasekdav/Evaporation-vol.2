import { useEffect, useId, useState, type ReactNode } from 'react';
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

interface FieldProps {
  text: FieldText;
  children: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
}

/** Pole formuláře s popiskem a rozbalovací nápovědou „proč na tom záleží“ (funguje i dotykem). */
export function Field({ text, children, hint, error, htmlFor }: FieldProps) {
  const [open, setOpen] = useState(false);
  const helpId = useId();
  return (
    <div className={`field${error ? ' field-error' : ''}`}>
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
      {error ? (
        <div className="hint err" role="alert">
          {error}
        </div>
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
}

/** Číselné pole s jednotkou. Drží vlastní text, aby šlo psát „-“ nebo „5,“ bez přepisování. */
export function NumberInput({ id, value, onChange, unit, optional, placeholder, disabled, ariaLabel }: NumberInputProps) {
  const [text, setText] = useState(formatEditable(value));
  useEffect(() => {
    const parsed = parseNumber(text);
    const same = parsed === value || (parsed !== null && value !== null && Number.isNaN(parsed) && Number.isNaN(value));
    if (!same) setText(formatEditable(value));
  }, [value]);
  const parsed = parseNumber(text);
  const invalid = (parsed === null && !optional) || (parsed !== null && Number.isNaN(parsed));
  return (
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
        onChange={(e) => {
          setText(e.target.value);
          const p = parseNumber(e.target.value);
          onChange(p === null ? (optional ? null : Number.NaN) : p);
        }}
      />
      <span className="unit">{unit}</span>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
