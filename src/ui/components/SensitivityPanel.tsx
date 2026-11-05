import { useMemo } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import type { Evaluation } from '../../core/evaluate';
import { fmt } from '../../core/format';
import { tr } from '../../core/i18n';
import { getProvider } from '../../core/properties';
import { absoluteHumidity_g_kg, LATENT_KJ_PER_G } from '../../core/psychro';
import { range, sweepAmbientTemp, sweepHumidity, sweepOutletTemp, type SensPoint } from '../../core/sensitivity';
import { LineChart } from './LineChart';
import { Qty, SourceTag } from './Qty';

function SensTable({ caption, xLabel, points }: { caption: string; xLabel: string; points: readonly SensPoint[] }) {
  return (
    <details className="table-view">
      <summary>{tr('Tabulka', 'Table')}: {caption}</summary>
      <div className="table-scroll" data-chart="">
        <table>
          <caption>
            {caption} <SourceTag src="VYPOCET" />
          </caption>
          <thead>
            <tr>
              <th scope="col">{xLabel} [°C]</th>
              <th scope="col">Q [kW]</th>
              <th scope="col">N_eq [{tr('Nm³/h kat.', 'Nm³/h cat.')}]</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.x}>
                <td>{fmt(p.x, 1)}</td>
                <td>{p.Q_kW === null ? '–' : fmt(p.Q_kW, 2)}</td>
                <td>{p.N_eq_Nm3_h === null ? tr('nelze', 'n/a') : fmt(p.N_eq_Nm3_h, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const toSeries = (pts: readonly SensPoint[], key: 'Q_kW' | 'N_eq_Nm3_h') => pts.map((p) => ({ x: p.x, y: p[key] }));

export function SensitivityPanel({ ev, basis }: { ev: Evaluation; basis: CatalogBasis | undefined }) {
  const d = ev.duty;
  const data = useMemo(() => {
    if (!d || !basis || ev.T_des_C === null) return null;
    const props = getProvider(ev.input.fluid);
    const base = { Vn_Nm3_h: d.Vn_Nm3_h, p_bar_a: d.p_bar_a, liquid: ev.input.liquid, T_out_C: d.T_out_C };
    return {
      tout: sweepOutletTemp(props, base, basis, ev.T_des_C, range(props.meta.T_gas_min_C, 20, 2.5)),
      tamb: sweepAmbientTemp(props, base, basis, range(-20, 20, 1)),
      hum: sweepHumidity(ev.input.RH_winter_pct, range(-20, 20, 1)),
    };
  }, [d, basis, ev.T_des_C, ev.input.fluid, ev.input.liquid]);
  if (!d || !data) return null;
  const neqNow = ev.sizing?.ok ? ev.sizing.N_eq_Nm3_h : null;
  const T_des = ev.T_des_C!;
  const RH = ev.input.RH_winter_pct;
  const xSummer = absoluteHumidity_g_kg(20, 75);
  const xWinter = absoluteHumidity_g_kg(-15, 85);

  return (
    <section className="card" aria-labelledby="sens-h">
      <h2 id="sens-h">{tr('Citlivost', 'Sensitivity')}</h2>
      <p className="note" data-narrative="">
        {tr(
          'Výkon v kW se s výstupní teplotou mění jen málo a na teplotě okolí nezávisí vůbec. Ideální ekvivalent N_eq (k = 1) roste prudce, když se výstupní teplota blíží teplotě vzduchu. Proto se odpařovač nevybírá podle kW.',
          'The duty in kW changes only slightly with the outlet temperature and does not depend on ambient temperature at all. The ideal equivalent N_eq (k = 1) rises steeply as the outlet temperature approaches the air temperature. That is why a vaporizer is not selected by kW.',
        )}
      </p>
      <h3>
        {tr('Vs. výstupní teplota (vzduch', 'Vs. outlet temperature (air')} <Qty v={T_des} unit="°C" src="VYPOCET" d={1} />)
      </h3>
      <div className="chart-grid">
        <LineChart
          title={tr('Výkon Q vs. výstupní teplota', 'Duty Q vs. outlet temperature')}
          src="VYPOCET"
          xLabel="T_out"
          xUnit="°C"
          yLabel="Q"
          yUnit="kW"
          yDecimals={2}
          xDecimals={1}
          series={[{ name: 'Q', slot: 1, points: toSeries(data.tout, 'Q_kW') }]}
          marker={{ x: d.T_out_C, y: d.Q_kW, label: tr('návrh', 'design') }}
        />
        <LineChart
          title={tr('N_eq vs. výstupní teplota', 'N_eq vs. outlet temperature')}
          src="VYPOCET"
          xLabel="T_out"
          xUnit="°C"
          yLabel="N_eq"
          yUnit={tr('Nm³/h kat.', 'Nm³/h cat.')}
          yDecimals={1}
          xDecimals={1}
          series={[{ name: 'N_eq', slot: 1, points: toSeries(data.tout, 'N_eq_Nm3_h') }]}
          marker={neqNow !== null ? { x: d.T_out_C, y: neqNow, label: tr('návrh', 'design') } : null}
          note={tr(
            `Nad T_out ≥ ${fmt(T_des, 1)} °C (teplota vzduchu pro posouzení) atmosférický odpařovač výstupní teploty nedosáhne – křivka končí.`,
            `Above T_out ≥ ${fmt(T_des, 1)} °C (air temperature for assessment) an ambient vaporizer cannot reach the outlet temperature – the curve ends.`,
          )}
        />
      </div>
      <SensTable caption={tr('Q a N_eq vs. výstupní teplota', 'Q and N_eq vs. outlet temperature')} xLabel="T_out" points={data.tout} />

      <h3>
        {tr('Vs. teplota okolí', 'Vs. ambient temperature')} <span data-narrative="">{tr('(−20 až +20 °C)', '(−20 to +20 °C)')}</span>, T_out{' '}
        <Qty v={d.T_out_C} unit="°C" src="VSTUP" d={1} />
      </h3>
      <div className="chart-grid">
        <LineChart
          title={tr('Výkon Q vs. teplota okolí', 'Duty Q vs. ambient temperature')}
          src="VYPOCET"
          xLabel={tr('T_okolí', 'T_amb')}
          xUnit="°C"
          yLabel="Q"
          yUnit="kW"
          yDecimals={2}
          series={[{ name: 'Q', slot: 1, points: toSeries(data.tamb, 'Q_kW') }]}
          note={tr('Q na teplotě okolí nezávisí: potřeba tepla je dána látkou, tlakem a teplotami kapaliny a plynu.', 'Q does not depend on ambient temperature: the heat demand is set by the fluid, pressure and liquid and gas temperatures.')}
        />
        <LineChart
          title={tr('N_eq vs. teplota okolí', 'N_eq vs. ambient temperature')}
          src="VYPOCET"
          xLabel={tr('T_okolí', 'T_amb')}
          xUnit="°C"
          yLabel="N_eq"
          yUnit={tr('Nm³/h kat.', 'Nm³/h cat.')}
          yDecimals={1}
          series={[{ name: 'N_eq', slot: 1, points: toSeries(data.tamb, 'N_eq_Nm3_h') }]}
          marker={neqNow !== null && T_des >= -20 && T_des <= 20 ? { x: T_des, y: neqNow, label: tr('posouzení', 'assessment') } : null}
          note={tr('Model konstantního U – optimistický; v mrazu skutečná potřeba roste ještě víc (námraza, chybějící latentní teplo).', 'Constant-U model – optimistic; in frost the real requirement grows even more (icing, missing latent heat).')}
        />
      </div>
      <SensTable caption={tr('Q a N_eq vs. teplota okolí', 'Q and N_eq vs. ambient temperature')} xLabel={tr('T_okolí', 'T_amb')} points={data.tamb} />

      <h3>{tr('Absolutní vlhkost vzduchu vs. teplota (vysvětlující model)', 'Absolute air humidity vs. temperature (explanatory model)')}</h3>
      <div className="chart-grid one">
        <LineChart
          title={tr('Absolutní vlhkost x vs. teplota', 'Absolute humidity x vs. temperature')}
          src="VYPOCET"
          xLabel="T"
          xUnit="°C"
          yLabel="x"
          yUnit="g/kg"
          yDecimals={2}
          series={[
            { name: `RH ${fmt(RH, 0)} %`, slot: 1, points: data.hum.map((p) => ({ x: p.T_C, y: p.x_RH_g_kg })) },
            { name: tr('nasycení 100 %', 'saturation 100 %'), slot: 2, points: data.hum.map((p) => ({ x: p.T_C, y: p.x_sat_g_kg })) },
          ]}
          note={tr('Magnusův vzorec, pod 0 °C nad ledem (RH vztažená k ledu; meteorologická RH se udává vůči vodě – vyšlo by asi o 15 % víc vody). Neslouží k dimenzování.', 'Magnus formula, below 0 °C over ice (RH relative to ice; meteorological RH is given relative to water – it would give about 15 % more water). Not for sizing.')}
        />
      </div>
      <p className="note">
        <span data-narrative="">{tr('Při 20 °C a 75 % RH nese vzduch ', 'At 20 °C and 75 % RH the air carries ')}</span>
        <Qty v={xSummer} unit="g/kg" src="VYPOCET" />
        <span data-narrative="">{tr(', při −15 °C a 85 % RH jen ', ', at −15 °C and 85 % RH only ')}</span>
        <Qty v={xWinter} unit="g/kg" src="VYPOCET" />
        <span data-narrative="">{tr('. Každý vymrzlý gram vody odevzdá asi ', '. Each gram of water frozen out releases about ')}</span>
        <Qty v={LATENT_KJ_PER_G} unit="kJ/g" src="VYPOCET" d={1} />
        <span data-narrative="">
          {' '}
          {tr(
            'latentního tepla – v mrazu tento příspěvek chybí, a katalogová kapacita (měřená při vyšší teplotě a vlhkosti) proto nadhodnocuje skutečný výkon.',
            'of latent heat – in frost this contribution is missing, so the catalogue capacity (measured at higher temperature and humidity) overstates the real performance.',
          )}
        </span>
      </p>
      <details className="table-view">
        <summary>{tr('Tabulka: absolutní vlhkost', 'Table: absolute humidity')}</summary>
        <div className="table-scroll" data-chart="">
          <table>
            <caption>
              {tr('Absolutní vlhkost x [g/kg]', 'Absolute humidity x [g/kg]')} <SourceTag src="VYPOCET" />
            </caption>
            <thead>
              <tr>
                <th scope="col">T [°C]</th>
                <th scope="col">{tr('x při RH', 'x at RH')} {fmt(RH, 0)} % [g/kg]</th>
                <th scope="col">{tr('x při 100 % [g/kg]', 'x at 100 % [g/kg]')}</th>
              </tr>
            </thead>
            <tbody>
              {data.hum.map((p) => (
                <tr key={p.T_C}>
                  <td>{fmt(p.T_C, 0)}</td>
                  <td>{fmt(p.x_RH_g_kg, 2)}</td>
                  <td>{fmt(p.x_sat_g_kg, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
