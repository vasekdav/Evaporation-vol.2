import { useId, useState } from 'react';
import { CATALOG_BASES, findBasis, type CatalogBasis } from '../../core/catalog';
import type { PressureKind } from '../../core/units';
import { FIELD } from '../texts';
import { Field, NumberInput, Segmented } from './fields';

interface Props {
  selectedId: string;
  customBases: readonly CatalogBasis[];
  onSelect: (id: string) => void;
  onChangeBases: (bases: CatalogBasis[]) => void;
  hint: string;
}

type Draft = Omit<CatalogBasis, 'T_amb_C'> & { T_amb_C: number | null };

const newId = () => `own-${Date.now().toString(36)}`;

/**
 * Výběr a úprava katalogových základů. Vestavěné základy se neupravují přímo –
 * úprava vytvoří vlastní kopii. Vlastní základy se ukládají v prohlížeči.
 */
export function BasisEditor({ selectedId, customBases, onSelect, onChangeBases, hint }: Props) {
  const ids = { sel: useId(), name: useId(), tamb: useId(), rh: useId(), p: useId(), appr: useId(), run: useId(), wind: useId(), note: useId() };
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = findBasis(selectedId, customBases);
  const isCustom = selectedId.startsWith('own-');

  const startEdit = () => {
    if (!current) return;
    setDraft(
      isCustom
        ? { ...current }
        : { ...current, id: newId(), name: `${current.name} (vlastní kopie)`, source: `kopie: ${current.source}`, pressureVerified: current.pressureVerified },
    );
  };
  const startNew = () =>
    setDraft({
      id: newId(),
      name: 'Vlastní základ',
      manufacturer: 'vlastní',
      T_amb_C: null,
      RH_pct: null,
      pressure: null,
      pressureVerified: null,
      approach_K: null,
      runtime_h: null,
      wind_m_s: null,
      hpLinedFactor: null,
      note: '',
      source: 'vlastní zadání',
      modelsId: null,
    });
  const valid = draft !== null && draft.name.trim() !== '' && draft.T_amb_C !== null && Number.isFinite(draft.T_amb_C);
  const save = () => {
    if (!draft || !valid) return;
    const b: CatalogBasis = { ...draft, T_amb_C: draft.T_amb_C!, pressureVerified: draft.pressure === null ? null : draft.pressureVerified };
    const others = customBases.filter((x) => x.id !== b.id);
    onChangeBases([...others, b]);
    onSelect(b.id);
    setDraft(null);
  };
  const remove = () => {
    onChangeBases(customBases.filter((x) => x.id !== selectedId));
    onSelect(CATALOG_BASES[0]!.id);
  };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <>
      <Field text={FIELD.basis} htmlFor={ids.sel} hint={hint}>
        <select id={ids.sel} value={selectedId} onChange={(e) => onSelect(e.target.value)}>
          <optgroup label="Knihovna (ilustrativní)">
            {CATALOG_BASES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </optgroup>
          {customBases.length ? (
            <optgroup label="Vlastní">
              {customBases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        {current ? (
          <div className="basis-note" data-narrative="">
            {current.note}
          </div>
        ) : null}
        <div className="row basis-actions">
          <button type="button" className="btn" onClick={startEdit} disabled={!current}>
            {isCustom ? 'Upravit' : 'Upravit jako vlastní kopii'}
          </button>
          <button type="button" className="btn" onClick={startNew}>
            Nový základ
          </button>
          {isCustom ? (
            <button type="button" className="btn btn-danger" onClick={remove}>
              Smazat
            </button>
          ) : null}
        </div>
      </Field>
      {draft ? (
        <div className="basis-editor" role="group" aria-label="Úprava katalogového základu">
          <label htmlFor={ids.name}>Název</label>
          <input id={ids.name} className="text-input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
          <label htmlFor={ids.tamb}>Teplota okolí (katalog)</label>
          <NumberInput id={ids.tamb} value={draft.T_amb_C} unit="°C" optional onChange={(v) => set('T_amb_C', v)} />
          <label htmlFor={ids.rh}>Relativní vlhkost</label>
          <NumberInput id={ids.rh} value={draft.RH_pct} unit="%" optional onChange={(v) => set('RH_pct', v)} />
          <label htmlFor={ids.p}>Tlak (katalog)</label>
          <div className="row">
            <NumberInput
              id={ids.p}
              value={draft.pressure?.value ?? null}
              unit={draft.pressure?.kind === 'abs' ? 'bar a' : 'barg'}
              optional
              onChange={(v) => set('pressure', v === null ? null : { kind: draft.pressure?.kind ?? 'gauge', value: v })}
            />
            <Segmented<PressureKind>
              ariaLabel="Druh katalogového tlaku"
              value={draft.pressure?.kind ?? 'gauge'}
              options={[
                { value: 'gauge', label: 'přetlak' },
                { value: 'abs', label: 'absolutní' },
              ]}
              onChange={(k) => set('pressure', draft.pressure ? { ...draft.pressure, kind: k } : null)}
            />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.pressureVerified === true}
              onChange={(e) => set('pressureVerified', e.target.checked)}
            />
            Tlak ověřen v podkladu výrobce
          </label>
          <label htmlFor={ids.appr}>Přiblížení výstupní teploty k okolí</label>
          <NumberInput id={ids.appr} value={draft.approach_K} unit="K" optional onChange={(v) => set('approach_K', v)} />
          <label htmlFor={ids.run}>Doba provozu</label>
          <NumberInput id={ids.run} value={draft.runtime_h} unit="h" optional onChange={(v) => set('runtime_h', v)} />
          <label htmlFor={ids.wind}>Vítr</label>
          <NumberInput id={ids.wind} value={draft.wind_m_s} unit="m/s" optional onChange={(v) => set('wind_m_s', v)} />
          <label htmlFor={ids.note}>Poznámka / zdroj</label>
          <textarea id={ids.note} className="text-input" rows={3} value={draft.note} onChange={(e) => set('note', e.target.value)} />
          <p className="hint" data-narrative="">
            Pro výpočet UA₁ je potřeba teplota okolí, tlak a přiblížení. Údaje opiš z katalogu výrobce – aplikace žádné nedoplňuje.
            Vlastní základy se ukládají jen v tomto prohlížeči.
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
              Uložit
            </button>
            <button type="button" className="btn" onClick={() => setDraft(null)}>
              Zrušit
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
