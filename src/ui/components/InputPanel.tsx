import { useId, type ReactNode } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import { fmt } from '../../core/format';
import { FLUID_POLICY } from '../../core/fluids';
import { withFluid, type Availability, type DesignInput } from '../../core/input';
import { getProvider } from '../../core/properties';
import type { FluidId } from '../../core/properties/types';
import { FLOW_PER_NM3, type FlowUnit, type PressureKind } from '../../core/units';
import { FIELD } from '../texts';
import { tr } from '../../core/i18n';
import { BasisEditor } from './BasisEditor';
import { Field, NumberInput, Segmented, type FieldIssue } from './fields';
import type { InputField } from '../../core/checks';

const FLOW_UNITS: readonly { value: FlowUnit; label: string }[] = [
  { value: 'Nm3/h', label: 'Nm³/h (0 °C)' },
  { value: 'Sm3/h', label: 'Sm³/h (15 °C)' },
  { value: 'scfh60', label: 'scfh (60 °F)' },
  { value: 'scfh70', label: 'scfh (70 °F)' },
];

const FLOW_UNIT_SHORT: Record<FlowUnit, string> = {
  'Nm3/h': 'Nm³/h',
  'Sm3/h': 'Sm³/h',
  scfh60: 'scfh',
  scfh70: 'scfh',
};

const round6 = (x: number) => Number(x.toPrecision(10));

function convertFlow(v: number, from: FlowUnit, to: FlowUnit): number {
  return Number.isFinite(v) ? round6((v / FLOW_PER_NM3[from]) * FLOW_PER_NM3[to]) : v;
}

function Group({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <fieldset className="group" id={id} tabIndex={-1}>
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

interface Props {
  input: DesignInput;
  onChange: (next: DesignInput) => void;
  onReset: () => void;
  customBases: readonly CatalogBasis[];
  onCustomBasesChange: (bases: CatalogBasis[]) => void;
  /** nálezy kontrol podle pole */
  issues?: Partial<Record<InputField, FieldIssue[]>>;
}

export function InputPanel({ input, onChange, onReset, customBases, onCustomBasesChange, issues = {} }: Props) {
  // jedna kontrola může patřit k více polím téže položky – zobrazit ji jen jednou
  const iss = (...keys: InputField[]): FieldIssue[] => [...new Map(keys.flatMap((k) => issues[k] ?? []).map((i) => [i.text, i])).values()];
  const bad = (k: InputField) => (issues[k] ?? []).some((i) => i.level === 'CHYBA');
  const set = <K extends keyof DesignInput>(key: K, value: DesignInput[K]) => onChange({ ...input, [key]: value });
  const meta = getProvider(input.fluid).meta;
  const policy = FLUID_POLICY[input.fluid];
  const ids = {
    flow: useId(),
    avg: useId(),
    p: useId(),
    patm: useId(),
    tin: useId(),
    tout: useId(),
    tamb: useId(),
    tmin: useId(),
    rh: useId(),
    frost: useId(),
    pipe: useId(),
    tsl: useId(),
    margin: useId(),
    hours: useId(),
    tact: useId(),
    k: useId(),
  };
  const flowUnit = input.flow.unit;

  const setPressureKind = (kind: PressureKind) => {
    if (kind === input.pressure.kind) return;
    const v = input.pressure.value;
    const conv = Number.isFinite(v) ? round6(kind === 'abs' ? v + input.p_atm_bar_a : v - input.p_atm_bar_a) : v;
    set('pressure', { kind, value: conv });
  };

  const setFlowUnit = (unit: FlowUnit) =>
    onChange({
      ...input,
      flow: { unit, value: convertFlow(input.flow.value, flowUnit, unit) },
      avgFlow: input.avgFlow ? { unit, value: convertFlow(input.avgFlow.value, input.avgFlow.unit, unit) } : null,
    });

  return (
    <form className="inputs-form" onSubmit={(e) => e.preventDefault()} aria-label={tr('Vstupy', 'Inputs')}>
      <div className="inputs-top">
        <h2>{tr('Vstupy', 'Inputs')}</h2>
        <button type="button" className="link-btn" onClick={onReset}>
          {tr('Výchozí hodnoty', 'Defaults')}
        </button>
      </div>

      <Group title={tr('1 · Potřeba', '1 · Demand')} id="grp-need">
        <Field text={FIELD.fluid} issues={iss('fluid')}>
          <Segmented<FluidId>
            ariaLabel={tr('Látka', 'Fluid')}
            value={input.fluid}
            options={[
              { value: 'O2', label: tr('O₂ kyslík', 'O₂ oxygen') },
              { value: 'N2', label: tr('N₂ dusík', 'N₂ nitrogen') },
              { value: 'Ar', label: tr('Ar argon', 'Ar argon') },
            ]}
            onChange={(f) => onChange(withFluid(input, f))}
          />
        </Field>
        <Field text={FIELD.flow} issues={iss('flow')} htmlFor={ids.flow} hint={tr('Zadej špičku, ne průměr.', 'Enter the peak, not the average.')}>
          <div className="row">
            <NumberInput
              id={ids.flow} flagged={bad('flow')}
              value={input.flow.value}
              unit={FLOW_UNIT_SHORT[flowUnit]}
              onChange={(v) => set('flow', { ...input.flow, value: v ?? Number.NaN })}
            />
            <select aria-label={tr('Jednotka průtoku', 'Flow unit')} value={flowUnit} onChange={(e) => setFlowUnit(e.target.value as FlowUnit)}>
              {FLOW_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </Field>
        <Field text={FIELD.avgFlow} issues={iss('avgFlow')} htmlFor={ids.avg}>
          <NumberInput
            id={ids.avg} flagged={bad('avgFlow')}
            optional
            value={input.avgFlow?.value ?? null}
            unit={FLOW_UNIT_SHORT[flowUnit]}
            onChange={(v) => set('avgFlow', v === null ? null : { unit: flowUnit, value: v })}
          />
        </Field>
      </Group>

      <Group title={tr('2 · Procesní podmínky', '2 · Process conditions')} id="grp-process">
        <Field
          text={FIELD.pressure} issues={iss('pressure')}
          htmlFor={ids.p}
          hint={`${tr('Rozsah', 'Range')} ${policy.formula}: ${fmt(meta.p_min_bar_a, 0)}–${fmt(meta.p_max_bar_a, 0)} bar a`}
        >
          <div className="row">
            <NumberInput
              id={ids.p} flagged={bad('pressure')}
              value={input.pressure.value}
              unit={input.pressure.kind === 'gauge' ? 'barg' : 'bar a'}
              onChange={(v) => set('pressure', { ...input.pressure, value: v ?? Number.NaN })}
            />
            <Segmented<PressureKind>
              ariaLabel={tr('Druh tlaku', 'Pressure type')}
              value={input.pressure.kind}
              options={[
                { value: 'gauge', label: tr('přetlak', 'gauge') },
                { value: 'abs', label: tr('absolutní', 'absolute') },
              ]}
              onChange={setPressureKind}
            />
          </div>
        </Field>
        <Field text={FIELD.p_atm} issues={iss('p_atm_bar_a')} htmlFor={ids.patm}>
          <NumberInput
            id={ids.patm} flagged={bad('p_atm_bar_a')}
            value={input.p_atm_bar_a}
            unit="bar a"
            onChange={(v) => set('p_atm_bar_a', v ?? Number.NaN)}
          />
        </Field>
        <Field text={FIELD.liquid}>
          <Segmented<'subcooled' | 'saturated'>
            ariaLabel={tr('Stav kapaliny', 'Liquid state')}
            value={input.liquid.kind}
            options={[
              { value: 'subcooled', label: tr('podchlazená', 'subcooled') },
              { value: 'saturated', label: tr('nasycená (minimum)', 'saturated (minimum)') },
            ]}
            onChange={(k) =>
              set('liquid', k === 'saturated' ? { kind: 'saturated' } : { kind: 'subcooled', T_C: policy.T_in_default_C })
            }
          />
        </Field>
        {input.liquid.kind === 'subcooled' ? (
          <Field
            text={FIELD.T_in} issues={iss('liquid')}
            htmlFor={ids.tin}
            hint={tr(
              `Od ${fmt(meta.T_liq_min_C, 0)} °C do T_sat při provozním tlaku; návrhový případ ${fmt(policy.T_in_default_C, 0)} °C`,
              `From ${fmt(meta.T_liq_min_C, 0)} °C to T_sat at operating pressure; design case ${fmt(policy.T_in_default_C, 0)} °C`,
            )}
          >
            <NumberInput
              id={ids.tin} flagged={bad('liquid')}
              value={input.liquid.T_C}
              unit="°C"
              onChange={(v) => set('liquid', { kind: 'subcooled', T_C: v ?? Number.NaN })}
            />
          </Field>
        ) : null}
        <Field
          text={FIELD.T_out} issues={iss('T_out_C')}
          htmlFor={ids.tout}
          hint={tr(
            `Rozsah ${fmt(meta.T_gas_min_C, 0)} až +${fmt(meta.T_gas_max_C, 0)} °C, pod teplotou okolí`,
            `Range ${fmt(meta.T_gas_min_C, 0)} to +${fmt(meta.T_gas_max_C, 0)} °C, below ambient temperature`,
          )}
        >
          <NumberInput id={ids.tout} flagged={bad('T_out_C')} value={input.T_out_C} unit="°C" onChange={(v) => set('T_out_C', v ?? Number.NaN)} />
        </Field>
      </Group>

      <Group title={tr('3 · Klima lokality', '3 · Site climate')} id="grp-climate">
        <Field text={FIELD.T_amb} issues={iss('T_amb_C')} htmlFor={ids.tamb}>
          <NumberInput id={ids.tamb} flagged={bad('T_amb_C')} value={input.T_amb_C} unit="°C" onChange={(v) => set('T_amb_C', v ?? Number.NaN)} />
        </Field>
        <Field text={FIELD.T_min_site} issues={iss('T_min_site_C')} htmlFor={ids.tmin} hint={tr('Výpočtové teploty ČSN nejsou absolutní minima.', 'Design temperatures per ČSN are not absolute minima.')}>
          <NumberInput id={ids.tmin} flagged={bad('T_min_site_C')} optional value={input.T_min_site_C} unit="°C" onChange={(v) => set('T_min_site_C', v)} />
        </Field>
        <Field text={FIELD.RH} issues={iss('RH_winter_pct')} htmlFor={ids.rh}>
          <NumberInput id={ids.rh} flagged={bad('RH_winter_pct')} value={input.RH_winter_pct} unit="%" onChange={(v) => set('RH_winter_pct', v ?? Number.NaN)} />
        </Field>
        <Field text={FIELD.frostWeeks} issues={iss('frostWeeks')} htmlFor={ids.frost}>
          <NumberInput id={ids.frost} flagged={bad('frostWeeks')} optional value={input.frostWeeks} unit={tr('týdnů', 'weeks')} onChange={(v) => set('frostWeeks', v)} />
        </Field>
      </Group>

      <Group title={tr('4 · Bezpečnost (křehký lom, TSL)', '4 · Safety (brittle fracture, TSL)')} id="grp-safety">
        <Field text={FIELD.T_pipe_min} issues={iss('T_pipe_min_C')} htmlFor={ids.pipe}>
          <NumberInput id={ids.pipe} flagged={bad('T_pipe_min_C')} value={input.T_pipe_min_C} unit="°C" onChange={(v) => set('T_pipe_min_C', v ?? Number.NaN)} />
        </Field>
        <Field text={FIELD.TSL} issues={iss('TSL_C')} htmlFor={ids.tsl} hint={tr('Mez potrubí < TSL < návrhová T_out', 'Piping limit < TSL < design T_out')}>
          <NumberInput id={ids.tsl} flagged={bad('TSL_C')} optional value={input.TSL_C} unit="°C" onChange={(v) => set('TSL_C', v)} />
        </Field>
        <Field text={FIELD.TSL_margin} issues={iss('TSL_margin_K')} htmlFor={ids.margin}>
          <NumberInput id={ids.margin} flagged={bad('TSL_margin_K')} value={input.TSL_margin_K} unit="K" onChange={(v) => set('TSL_margin_K', v ?? Number.NaN)} />
        </Field>
      </Group>

      <Group title={tr('5 · Provoz', '5 · Operation')} id="grp-operation">
        <Field text={FIELD.hoursPerDay} issues={iss('hoursPerDay', 'continuous24_7')} htmlFor={ids.hours}>
          <div className="row">
            <NumberInput
              id={ids.hours} flagged={bad('hoursPerDay')}
              value={input.continuous24_7 ? 24 : input.hoursPerDay}
              unit={tr('h/den', 'h/day')}
              disabled={input.continuous24_7}
              onChange={(v) => set('hoursPerDay', v ?? Number.NaN)}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={input.continuous24_7}
                onChange={(e) => set('continuous24_7', e.target.checked)}
              />
              24/7
            </label>
          </div>
        </Field>
        <Field text={FIELD.availability} issues={iss('availability')}>
          <Segmented<Availability>
            ariaLabel={tr('Dostupnost', 'Availability')}
            value={input.availability}
            options={[
              { value: 'N', label: 'N' },
              { value: 'N+1', label: 'N+1' },
              { value: 'backup-heater', label: tr('záložní ohřívač', 'backup heater') },
            ]}
            onChange={(v) => set('availability', v)}
          />
        </Field>
        <Field text={FIELD.T_actual_out} issues={iss('T_actual_out_C')} htmlFor={ids.tact} hint={tr('Pro výpočet výkonu dohřevu.', 'For calculating the trim heater duty.')}>
          <NumberInput id={ids.tact} flagged={bad('T_actual_out_C')} optional value={input.T_actual_out_C} unit="°C" onChange={(v) => set('T_actual_out_C', v)} />
        </Field>
      </Group>

      <Group title={tr('6 · Katalogový základ (posouzení velikosti)', '6 · Catalogue basis (size assessment)')} id="grp-basis">
        <BasisEditor
          selectedId={input.catalogBasisId}
          customBases={customBases}
          onSelect={(id) => set('catalogBasisId', id)}
          onChangeBases={onCustomBasesChange}
          hint={`${tr('Sloupec katalogu pro', 'Catalogue column for')} ${policy.formula}: ${policy.catalogColumn}`}
        />
        <Field text={FIELD.k} issues={iss('k')} htmlFor={ids.k}>
          <NumberInput id={ids.k} flagged={bad('k')} value={input.k} unit="×" onChange={(v) => set('k', v ?? Number.NaN)} />
        </Field>
      </Group>
    </form>
  );
}
