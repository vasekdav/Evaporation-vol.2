import { useId, type ReactNode } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import { fmt } from '../../core/format';
import { FLUID_POLICY } from '../../core/fluids';
import { withFluid, type Availability, type DesignInput } from '../../core/input';
import { getProvider } from '../../core/properties';
import type { FluidId } from '../../core/properties/types';
import { FLOW_PER_NM3, type FlowUnit, type PressureKind } from '../../core/units';
import { FIELD } from '../texts';
import { BasisEditor } from './BasisEditor';
import { Field, NumberInput, Segmented } from './fields';

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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="group">
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
}

export function InputPanel({ input, onChange, onReset, customBases, onCustomBasesChange }: Props) {
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
    <form className="inputs-form" onSubmit={(e) => e.preventDefault()} aria-label="Vstupy">
      <div className="inputs-top">
        <h2>Vstupy</h2>
        <button type="button" className="link-btn" onClick={onReset}>
          Výchozí hodnoty
        </button>
      </div>

      <Group title="1 · Potřeba">
        <Field text={FIELD.fluid}>
          <Segmented<FluidId>
            ariaLabel="Látka"
            value={input.fluid}
            options={[
              { value: 'O2', label: 'O₂ kyslík' },
              { value: 'N2', label: 'N₂ dusík' },
            ]}
            onChange={(f) => onChange(withFluid(input, f))}
          />
        </Field>
        <Field text={FIELD.flow} htmlFor={ids.flow} hint="Zadej špičku, ne průměr.">
          <div className="row">
            <NumberInput
              id={ids.flow}
              value={input.flow.value}
              unit={FLOW_UNIT_SHORT[flowUnit]}
              onChange={(v) => set('flow', { ...input.flow, value: v ?? Number.NaN })}
            />
            <select aria-label="Jednotka průtoku" value={flowUnit} onChange={(e) => setFlowUnit(e.target.value as FlowUnit)}>
              {FLOW_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </Field>
        <Field text={FIELD.avgFlow} htmlFor={ids.avg}>
          <NumberInput
            id={ids.avg}
            optional
            value={input.avgFlow?.value ?? null}
            unit={FLOW_UNIT_SHORT[flowUnit]}
            onChange={(v) => set('avgFlow', v === null ? null : { unit: flowUnit, value: v })}
          />
        </Field>
      </Group>

      <Group title="2 · Procesní podmínky">
        <Field
          text={FIELD.pressure}
          htmlFor={ids.p}
          hint={`Rozsah ${policy.formula}: ${fmt(meta.p_min_bar_a, 0)}–${fmt(meta.p_max_bar_a, 0)} bar a`}
        >
          <div className="row">
            <NumberInput
              id={ids.p}
              value={input.pressure.value}
              unit={input.pressure.kind === 'gauge' ? 'barg' : 'bar a'}
              onChange={(v) => set('pressure', { ...input.pressure, value: v ?? Number.NaN })}
            />
            <Segmented<PressureKind>
              ariaLabel="Druh tlaku"
              value={input.pressure.kind}
              options={[
                { value: 'gauge', label: 'přetlak' },
                { value: 'abs', label: 'absolutní' },
              ]}
              onChange={setPressureKind}
            />
          </div>
        </Field>
        <Field text={FIELD.p_atm} htmlFor={ids.patm}>
          <NumberInput
            id={ids.patm}
            value={input.p_atm_bar_a}
            unit="bar a"
            onChange={(v) => set('p_atm_bar_a', v ?? Number.NaN)}
          />
        </Field>
        <Field text={FIELD.liquid}>
          <Segmented<'subcooled' | 'saturated'>
            ariaLabel="Stav kapaliny"
            value={input.liquid.kind}
            options={[
              { value: 'subcooled', label: 'podchlazená' },
              { value: 'saturated', label: 'nasycená (minimum)' },
            ]}
            onChange={(k) =>
              set('liquid', k === 'saturated' ? { kind: 'saturated' } : { kind: 'subcooled', T_C: policy.T_in_default_C })
            }
          />
        </Field>
        {input.liquid.kind === 'subcooled' ? (
          <Field
            text={FIELD.T_in}
            htmlFor={ids.tin}
            hint={`Od ${fmt(meta.T_liq_min_C, 0)} °C do T_sat při provozním tlaku; návrhový případ ${fmt(policy.T_in_default_C, 0)} °C`}
          >
            <NumberInput
              id={ids.tin}
              value={input.liquid.T_C}
              unit="°C"
              onChange={(v) => set('liquid', { kind: 'subcooled', T_C: v ?? Number.NaN })}
            />
          </Field>
        ) : null}
        <Field
          text={FIELD.T_out}
          htmlFor={ids.tout}
          hint={`Rozsah ${fmt(meta.T_gas_min_C, 0)} až +${fmt(meta.T_gas_max_C, 0)} °C, pod teplotou okolí`}
        >
          <NumberInput id={ids.tout} value={input.T_out_C} unit="°C" onChange={(v) => set('T_out_C', v ?? Number.NaN)} />
        </Field>
      </Group>

      <Group title="3 · Klima lokality">
        <Field text={FIELD.T_amb} htmlFor={ids.tamb}>
          <NumberInput id={ids.tamb} value={input.T_amb_C} unit="°C" onChange={(v) => set('T_amb_C', v ?? Number.NaN)} />
        </Field>
        <Field text={FIELD.T_min_site} htmlFor={ids.tmin} hint="Výpočtové teploty ČSN nejsou absolutní minima.">
          <NumberInput id={ids.tmin} optional value={input.T_min_site_C} unit="°C" onChange={(v) => set('T_min_site_C', v)} />
        </Field>
        <Field text={FIELD.RH} htmlFor={ids.rh}>
          <NumberInput id={ids.rh} value={input.RH_winter_pct} unit="%" onChange={(v) => set('RH_winter_pct', v ?? Number.NaN)} />
        </Field>
        <Field text={FIELD.frostWeeks} htmlFor={ids.frost}>
          <NumberInput id={ids.frost} optional value={input.frostWeeks} unit="týdnů" onChange={(v) => set('frostWeeks', v)} />
        </Field>
      </Group>

      <Group title="4 · Bezpečnost (křehký lom, TSL)">
        <Field text={FIELD.T_pipe_min} htmlFor={ids.pipe}>
          <NumberInput id={ids.pipe} value={input.T_pipe_min_C} unit="°C" onChange={(v) => set('T_pipe_min_C', v ?? Number.NaN)} />
        </Field>
        <Field text={FIELD.TSL} htmlFor={ids.tsl} hint="Mez potrubí < TSL < návrhová T_out">
          <NumberInput id={ids.tsl} optional value={input.TSL_C} unit="°C" onChange={(v) => set('TSL_C', v)} />
        </Field>
        <Field text={FIELD.TSL_margin} htmlFor={ids.margin}>
          <NumberInput id={ids.margin} value={input.TSL_margin_K} unit="K" onChange={(v) => set('TSL_margin_K', v ?? Number.NaN)} />
        </Field>
      </Group>

      <Group title="5 · Provoz">
        <Field text={FIELD.hoursPerDay} htmlFor={ids.hours}>
          <div className="row">
            <NumberInput
              id={ids.hours}
              value={input.continuous24_7 ? 24 : input.hoursPerDay}
              unit="h/den"
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
        <Field text={FIELD.availability}>
          <Segmented<Availability>
            ariaLabel="Dostupnost"
            value={input.availability}
            options={[
              { value: 'N', label: 'N' },
              { value: 'N+1', label: 'N+1' },
              { value: 'backup-heater', label: 'záložní ohřívač' },
            ]}
            onChange={(v) => set('availability', v)}
          />
        </Field>
        <Field text={FIELD.T_actual_out} htmlFor={ids.tact} hint="Pro výpočet výkonu dohřevu.">
          <NumberInput id={ids.tact} optional value={input.T_actual_out_C} unit="°C" onChange={(v) => set('T_actual_out_C', v)} />
        </Field>
      </Group>

      <Group title="6 · Katalogový základ (posouzení velikosti)">
        <BasisEditor
          selectedId={input.catalogBasisId}
          customBases={customBases}
          onSelect={(id) => set('catalogBasisId', id)}
          onChangeBases={onCustomBasesChange}
          hint={`Sloupec katalogu pro ${policy.formula}: ${policy.catalogColumn}`}
        />
        <Field text={FIELD.k} htmlFor={ids.k}>
          <NumberInput id={ids.k} value={input.k} unit="–" onChange={(v) => set('k', v ?? Number.NaN)} />
        </Field>
      </Group>
    </form>
  );
}
