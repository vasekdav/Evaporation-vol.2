import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { fmt } from '../../core/format';
import { tr } from '../../core/i18n';
import type { Source } from '../texts';
import { SourceTag } from './Qty';

export interface Series {
  name: string;
  /** 1 nebo 2 – kategorický slot (pevné pořadí) */
  slot: 1 | 2;
  points: readonly { x: number; y: number | null }[];
}

interface Props {
  title: string;
  src: Source;
  xLabel: string;
  xUnit: string;
  yLabel: string;
  yUnit: string;
  series: readonly Series[];
  /** aktuální návrhový bod */
  marker?: { x: number; y: number; label: string } | null;
  xDecimals?: number;
  yDecimals?: number;
  note?: string;
}

const W = 520;
const H = 240;
const M = { l: 58, r: 18, t: 14, b: 40 };

/** „Pěkné“ dělení osy: 1, 2, 2,5, 5 × 10^n. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  if (!(hi > lo)) {
    const pad = Math.abs(lo) * 0.05 || 1;
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

export function LineChart({ title, src, xLabel, xUnit, yLabel, yUnit, series, marker, xDecimals = 0, yDecimals = 0, note }: Props) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const xs = useMemo(() => series[0]?.points.map((p) => p.x) ?? [], [series]);
  const { xT, yT, sx, sy } = useMemo(() => {
    const yv = series.flatMap((s) => s.points.map((p) => p.y)).filter((y): y is number => y !== null);
    if (marker) yv.push(marker.y);
    const yTicks = niceTicks(Math.min(...yv), Math.max(...yv));
    const xTicks = niceTicks(Math.min(...xs), Math.max(...xs), 8);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = yTicks[0]!;
    const y1 = yTicks[yTicks.length - 1]!;
    return {
      xT: xTicks.filter((t) => t >= x0 - 1e-9 && t <= x1 + 1e-9),
      yT: yTicks,
      sx: (x: number) => M.l + ((x - x0) / (x1 - x0 || 1)) * (W - M.l - M.r),
      sy: (y: number) => H - M.b - ((y - y0) / (y1 - y0 || 1)) * (H - M.t - M.b),
    };
  }, [series, xs, marker]);

  const paths = series.map((s) => {
    let d = '';
    let pen = false;
    for (const p of s.points) {
      if (p.y === null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
      pen = true;
    }
    return d;
  });

  const nearest = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || xs.length === 0) return null;
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / (r.width || 1)) * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(sx(xs[i]!) - vx) < Math.abs(sx(xs[best]!) - vx)) best = i;
    return best;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => setHover(nearest(e.clientX));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = hover ?? (marker ? xs.findIndex((x) => x >= marker.x) : 0);
      const next = Math.min(xs.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      setHover(next);
    } else if (e.key === 'Escape') setHover(null);
  };

  const hx = hover !== null ? xs[hover] : undefined;
  // popisek se drží uvnitř grafu i u krajních bodů
  const tipLeftPct = hx !== undefined ? Math.min(82, Math.max(18, (sx(hx) / W) * 100)) : 0;
  const lastLabel = (s: Series) => {
    const pts = s.points.filter((p) => p.y !== null);
    return pts[pts.length - 1];
  };

  return (
    <figure className="chart" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="chart-title">
        {title} <SourceTag src={src} />
      </figcaption>
      {series.length > 1 ? (
        <div className="chart-legend" data-narrative="">
          {series.map((s) => (
            <span key={s.name}>
              <svg width="18" height="8" aria-hidden="true">
                <line x1="1" y1="4" x2="17" y2="4" className={`ln s${s.slot}`} />
              </svg>
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="chart-wrap" data-chart="">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-label={tr(
            `${title}. ${yLabel} [${yUnit}] v závislosti na ${xLabel} [${xUnit}]. Šipkami vlevo a vpravo procházej body; hodnoty jsou i v tabulce.`,
            `${title}. ${yLabel} [${yUnit}] versus ${xLabel} [${xUnit}]. Use the left and right arrows to step through points; values are also in the table.`,
          )}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {yT.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} className="grid" />
              <text x={M.l - 6} y={sy(t) + 4} textAnchor="end" className="tick">
                {fmt(t, Number.isInteger(t) ? 0 : 1)}
              </text>
            </g>
          ))}
          {xT.map((t) => (
            <text key={`x${t}`} x={sx(t)} y={H - M.b + 16} textAnchor="middle" className="tick">
              {fmt(t, 0)}
            </text>
          ))}
          <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} className="axis" />
          <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className="axis-title">
            {xLabel} [{xUnit}]
          </text>
          <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" className="axis-title" transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`}>
            {yLabel} [{yUnit}]
          </text>
          {paths.map((d, i) => (
            <path key={series[i]!.name} d={d} className={`ln s${series[i]!.slot}`} fill="none" />
          ))}
          {series.length > 1
            ? series.map((s) => {
                const p = lastLabel(s);
                return p ? (
                  <text key={`lbl${s.name}`} x={sx(p.x) - 4} y={sy(p.y!) - 8} textAnchor="end" className="direct-label">
                    {s.name}
                  </text>
                ) : null;
              })
            : null}
          {marker ? (
            <g>
              <circle cx={sx(marker.x)} cy={sy(marker.y)} r={5} className={`dot s1`} />
              <text x={sx(marker.x) + 8} y={sy(marker.y) - 8} className="direct-label">
                {marker.label}
              </text>
            </g>
          ) : null}
          {hx !== undefined ? (
            <g pointerEvents="none">
              <line x1={sx(hx)} x2={sx(hx)} y1={M.t} y2={H - M.b} className="crosshair" />
              {series.map((s) => {
                const y = s.points[hover!]?.y;
                return y === null || y === undefined ? null : (
                  <circle key={`h${s.name}`} cx={sx(hx)} cy={sy(y)} r={4} className={`dot s${s.slot}`} />
                );
              })}
            </g>
          ) : null}
        </svg>
        {hx !== undefined ? (
          <div className="tooltip" style={{ left: `${tipLeftPct}%` }} aria-hidden="true">
            <div className="tt-x">{`${xLabel} ${fmt(hx, xDecimals)} ${xUnit}`}</div>
            {series.map((s) => {
              const y = s.points[hover!]?.y;
              return (
                <div key={s.name} className="tt-row">
                  <svg width="14" height="6" aria-hidden="true">
                    <line x1="1" y1="3" x2="13" y2="3" className={`ln s${s.slot}`} />
                  </svg>
                  <strong>{y === null || y === undefined ? tr('nelze', 'n/a') : `${fmt(y, yDecimals)} ${yUnit}`}</strong>{' '}
                  <span className="muted">{s.name}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      {note ? (
        <p className="chart-note" data-narrative="">
          {note}
        </p>
      ) : null}
    </figure>
  );
}
