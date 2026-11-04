import { fmt } from '../../core/format';
import { SOURCE_LABEL, type Source } from '../texts';

/** Štítek původu čísla: VÝPOČET / PRAXE / ÚDAJ VÝROBCE / VSTUP. */
export function SourceTag({ src }: { src: Source }) {
  const s = SOURCE_LABEL[src];
  return (
    <abbr className={`src src-${src}`} title={s.long} aria-label={s.long}>
      {s.short}
    </abbr>
  );
}

interface QtyProps {
  v: number;
  unit: string;
  src: Source;
  /** počet desetinných míst */
  d?: number;
  /** zobrazit znaménko + u kladných čísel */
  signed?: boolean;
  className?: string;
}

/**
 * Jediný způsob, jak v UI zobrazit číslo: vždy s jednotkou a s původem.
 * Desetinná čárka podle CZ locale.
 */
export function Qty({ v, unit, src, d = 2, signed = false, className }: QtyProps) {
  const text = fmt(v, d);
  return (
    <span className={`qty${className ? ` ${className}` : ''}`} data-qty="" data-source={src} data-unit={unit}>
      <span className="num">{signed && v > 0 ? `+${text}` : text}</span>
      {unit ? <span className="unit">{unit}</span> : null}
      <SourceTag src={src} />
    </span>
  );
}
