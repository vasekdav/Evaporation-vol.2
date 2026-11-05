import { useId, useState } from 'react';
import { basisNote, CATALOG_BASES, findBasis, type CatalogBasis } from '../../core/catalog';
import type { PressureKind } from '../../core/units';
import { FIELD } from '../texts';
import { tr } from '../../core/i18n';
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
    // kopie nese jedinou poznámku v aktuálním jazyce (note_en patří jen vestavěným základům)
    const base: Draft = { ...current, note: basisNote(current) };
    delete base.note_en;
    setDraft(
      isCustom
        ? base
        : { ...base, id: newId(), name: `${current.name} (${tr('vlastní kopie', 'own copy')})`, source: `${tr('kopie', 'copy')}: ${current.source}`, pressureVerified: current.pressureVerified },
    );
  };
  const startNew = () =>
    setDraft({
      id: newId(),
      name: tr('Vlastní základ', 'Custom basis'),
      manufacturer: tr('vlastní', 'custom'),
      T_amb_C: null,
      RH_pct: null,
      pressure: null,
      pressureVerified: null,
      approach_K: null,
      runtime_h: null,
      wind_m_s: null,
      hpLinedFactor: null,
      note: '',
      source: tr('vlastní zadání', 'user input'),
      modelsId: null,
    });
  const draftError = (() => {
    if (!draft) return null;
    if (draft.name.trim() === '') return tr('Zadej název.', 'Enter a name.');
    if (draft.T_amb_C === null || !Number.isFinite(draft.T_amb_C) || draft.T_amb_C < -50 || draft.T_amb_C > 50)
      return tr('Teplota okolí musí být −50 až +50 °C.', 'Ambient temperature must be −50 to +50 °C.');
    if (draft.RH_pct !== null && !(draft.RH_pct >= 0 && draft.RH_pct <= 100)) return tr('Vlhkost musí být 0–100 %.', 'Humidity must be 0–100 %.');
    if (draft.pressure && !(draft.pressure.value > 0 && draft.pressure.value <= 100)) return tr('Tlak musí být kladný a nejvýš 100 bar.', 'Pressure must be positive and at most 100 bar.');
    if (draft.approach_K !== null && !(draft.approach_K >= 0.1 && draft.approach_K <= 60)) return tr('Přiblížení musí být 0,1–60 K.', 'Approach must be 0.1–60 K.');
    if (draft.runtime_h !== null && !(draft.runtime_h > 0 && draft.runtime_h <= 168)) return tr('Doba provozu musí být 0–168 h.', 'Run time must be 0–168 h.');
    if (draft.wind_m_s !== null && !(draft.wind_m_s >= 0 && draft.wind_m_s <= 50)) return tr('Vítr musí být 0–50 m/s.', 'Wind must be 0–50 m/s.');
    return null;
  })();
  const valid = draft !== null && draftError === null;
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
          <optgroup label={tr('Knihovna (ilustrativní)', 'Library (illustrative)')}>
            {CATALOG_BASES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </optgroup>
          {customBases.length ? (
            <optgroup label={tr('Vlastní', 'Custom')}>
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
            {basisNote(current)}
          </div>
        ) : null}
        <div className="row basis-actions">
          <button type="button" className="btn" onClick={startEdit} disabled={!current}>
            {isCustom ? tr('Upravit', 'Edit') : tr('Upravit jako vlastní kopii', 'Edit as own copy')}
          </button>
          <button type="button" className="btn" onClick={startNew}>
            {tr('Nový základ', 'New basis')}
          </button>
          {isCustom ? (
            <button type="button" className="btn btn-danger" onClick={remove}>
              {tr('Smazat', 'Delete')}
            </button>
          ) : null}
        </div>
      </Field>
      {draft ? (
        <div className="basis-editor" role="group" aria-label={tr('Úprava katalogového základu', 'Edit catalogue basis')}>
          <label htmlFor={ids.name}>{tr('Název', 'Name')}</label>
          <input id={ids.name} className="text-input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
          <label htmlFor={ids.tamb}>{tr('Teplota okolí (katalog)', 'Ambient temperature (catalogue)')}</label>
          <NumberInput id={ids.tamb} value={draft.T_amb_C} unit="°C" optional onChange={(v) => set('T_amb_C', v)} />
          <label htmlFor={ids.rh}>{tr('Relativní vlhkost', 'Relative humidity')}</label>
          <NumberInput id={ids.rh} value={draft.RH_pct} unit="%" optional onChange={(v) => set('RH_pct', v)} />
          <label htmlFor={ids.p}>{tr('Tlak (katalog)', 'Pressure (catalogue)')}</label>
          <div className="row">
            <NumberInput
              id={ids.p}
              value={draft.pressure?.value ?? null}
              unit={draft.pressure?.kind === 'abs' ? 'bar a' : 'barg'}
              optional
              onChange={(v) => set('pressure', v === null ? null : { kind: draft.pressure?.kind ?? 'gauge', value: v })}
            />
            <Segmented<PressureKind>
              ariaLabel={tr('Druh katalogového tlaku', 'Catalogue pressure type')}
              value={draft.pressure?.kind ?? 'gauge'}
              options={[
                { value: 'gauge', label: tr('přetlak', 'gauge') },
                { value: 'abs', label: tr('absolutní', 'absolute') },
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
            {tr('Tlak ověřen v podkladu výrobce', 'Pressure verified in manufacturer data')}
          </label>
          <label htmlFor={ids.appr}>{tr('Přiblížení výstupní teploty k okolí', 'Outlet temperature approach to ambient')}</label>
          <NumberInput id={ids.appr} value={draft.approach_K} unit="K" optional onChange={(v) => set('approach_K', v)} />
          <label htmlFor={ids.run}>{tr('Doba provozu', 'Run time')}</label>
          <NumberInput id={ids.run} value={draft.runtime_h} unit="h" optional onChange={(v) => set('runtime_h', v)} />
          <label htmlFor={ids.wind}>{tr('Vítr', 'Wind')}</label>
          <NumberInput id={ids.wind} value={draft.wind_m_s} unit="m/s" optional onChange={(v) => set('wind_m_s', v)} />
          <label htmlFor={ids.note}>{tr('Poznámka / zdroj', 'Note / source')}</label>
          <textarea id={ids.note} className="text-input" rows={3} value={draft.note} onChange={(e) => set('note', e.target.value)} />
          <p className="hint" data-narrative="">
            {tr(
              'Pro výpočet UA₁ je potřeba teplota okolí, tlak a přiblížení. Údaje opiš z katalogu výrobce – aplikace žádné nedoplňuje. Vlastní základy se ukládají jen v tomto prohlížeči.',
              'Calculating UA₁ needs the ambient temperature, pressure and approach. Copy the data from the manufacturer catalogue – the application fills in nothing. Custom bases are stored only in this browser.',
            )}
          </p>
          {draftError ? (
            <p className="hint err" role="alert">
              {draftError}
            </p>
          ) : null}
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
              {tr('Uložit', 'Save')}
            </button>
            <button type="button" className="btn" onClick={() => setDraft(null)}>
              {tr('Zrušit', 'Cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
