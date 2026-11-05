import type { ReactNode } from 'react';
import type { Evaluation } from '../../core/evaluate';
import { FLUID_POLICY } from '../../core/fluids';
import { getProvider } from '../../core/properties';
import { toNm3h } from '../../core/units';
import { tr } from '../../core/i18n';
import { Qty } from './Qty';

interface Step {
  n: number;
  title: string;
  formula: string;
  subst?: ReactNode;
  result: ReactNode;
  note?: string;
}

const F = ({ children }: { children: string }) => (
  <code className="formula" data-formula="">
    {children}
  </code>
);

/** Postup výpočtu krok za krokem s mezihodnotami a rovnicemi (kap. 5.1–5.2). */
export function StepByStep({ ev }: { ev: Evaluation }) {
  const d = ev.duty;
  if (!d) return null;
  const inp = ev.input;
  const meta = getProvider(inp.fluid).meta;
  const policy = FLUID_POLICY[inp.fluid];
  const sub = inp.liquid.kind === 'subcooled';
  const kj = 'kJ/kg';

  const steps: Step[] = [
    {
      n: 1,
      title: tr('Hustota za normálních podmínek', 'Density at normal conditions'),
      formula: tr('ρn = ρ(látka; 0 °C; 1,01325 bar) – reálný plyn ze stavové rovnice', 'ρn = ρ(fluid; 0 °C; 1.01325 bar) – real gas from the equation of state'),
      result: <Qty v={d.rho_n_kg_Nm3} unit="kg/Nm³" src="VYPOCET" d={6} />,
      note: `${policy.formula}: ${meta.eos ?? ''}, CoolProp ${meta.coolprop_version}`,
    },
    {
      n: 2,
      title: tr('Absolutní tlak', 'Absolute pressure'),
      formula: inp.pressure.kind === 'gauge' ? 'p = p_g + p_atm' : tr('p = zadaný absolutní tlak', 'p = entered absolute pressure'),
      subst:
        inp.pressure.kind === 'gauge' ? (
          <>
            <Qty v={inp.pressure.value} unit="barg" src="VSTUP" d={3} /> + <Qty v={inp.p_atm_bar_a} unit="bar a" src="VSTUP" d={5} />
          </>
        ) : undefined,
      result: <Qty v={d.p_bar_a} unit="bar a" src="VYPOCET" d={5} />,
      note: tr('Tlaková ztráta zanedbána: 0,5 bar tlakové ztráty by zvýšilo výkon o +0,05 až +0,15 % podle tlaku a T_out.', 'Pressure drop neglected: a 0.5 bar pressure drop would raise the duty by +0.05 to +0.15 % depending on pressure and T_out.'),
    },
    {
      n: 3,
      title: tr('Hmotnostní průtok', 'Mass flow'),
      formula: 'ṁ = V̇n · ρn / 3600',
      subst: (
        <>
          <Qty v={toNm3h(inp.flow)} unit="Nm³/h" src="VSTUP" d={1} /> · <Qty v={d.rho_n_kg_Nm3} unit="kg/Nm³" src="VYPOCET" d={6} />
        </>
      ),
      result: (
        <>
          <Qty v={d.m_kg_s} unit="kg/s" src="VYPOCET" d={5} /> = <Qty v={d.m_kg_h} unit="kg/h" src="VYPOCET" d={2} />
        </>
      ),
    },
    {
      n: 4,
      title: tr('Nasycení při provozním tlaku', 'Saturation at operating pressure'),
      formula: 'T_sat(p), h_l,sat(p), h_v,sat(p), r = h_v,sat − h_l,sat',
      result: (
        <span className="stack">
          <span>T_sat = <Qty v={d.T_sat_C} unit="°C" src="VYPOCET" d={3} /></span>
          <span>h_l,sat = <Qty v={d.h_l_sat_kJ_kg} unit={kj} src="VYPOCET" d={3} /></span>
          <span>h_v,sat = <Qty v={d.h_v_sat_kJ_kg} unit={kj} src="VYPOCET" d={3} /></span>
          <span>r = <Qty v={d.r_kJ_kg} unit={kj} src="VYPOCET" d={3} /></span>
        </span>
      ),
      note: tr('Referenční stav: h = 0 pro nasycenou kapalinu při 1,01325 bar (na výsledek nemá vliv).', 'Reference state: h = 0 for saturated liquid at 1.01325 bar (no effect on the result).'),
    },
    {
      n: 5,
      title: tr('Entalpie kapaliny na vstupu', 'Liquid enthalpy at inlet'),
      formula: sub
        ? tr('h_in = h_l(p, T_in) – podchlazená / stlačená kapalina', 'h_in = h_l(p, T_in) – subcooled / compressed liquid')
        : tr('h_in = h_l,sat(p) – nasycená kapalina', 'h_in = h_l,sat(p) – saturated liquid'),
      subst: sub ? <>T_in = <Qty v={d.T_in_C} unit="°C" src="VSTUP" d={2} /></> : undefined,
      result: <Qty v={d.h_in_kJ_kg} unit={kj} src="VYPOCET" d={3} />,
    },
    {
      n: 6,
      title: tr('Entalpie plynu na výstupu', 'Gas enthalpy at outlet'),
      formula: 'h_out = h(p, T_out)',
      subst: <>T_out = <Qty v={d.T_out_C} unit="°C" src="VSTUP" d={2} /></>,
      result: <Qty v={d.h_out_kJ_kg} unit={kj} src="VYPOCET" d={3} />,
    },
    {
      n: 7,
      title: tr('Rozklad měrného tepla', 'Specific heat breakdown'),
      formula: 'q₁ = h_l,sat − h_in;  q₂ = r;  q₃ = h_out − h_v,sat;  q = q₁ + q₂ + q₃',
      result: (
        <span className="stack">
          <span>q₁ {tr('ohřev kapaliny', 'liquid warming')} = <Qty v={d.q1_kJ_kg} unit={kj} src="VYPOCET" d={3} /></span>
          <span>q₂ {tr('výparné teplo', 'latent heat')} = <Qty v={d.q2_kJ_kg} unit={kj} src="VYPOCET" d={3} /></span>
          <span>q₃ {tr('přehřátí', 'superheating')} = <Qty v={d.q3_kJ_kg} unit={kj} src="VYPOCET" d={3} /></span>
          <span>q = <Qty v={d.q_kJ_kg} unit={kj} src="VYPOCET" d={3} /></span>
        </span>
      ),
    },
    {
      n: 8,
      title: tr('Výkon a zóny přestupu tepla', 'Duty and heat transfer zones'),
      formula: tr('Q = ṁ·q;  Q_I = ṁ·(q₁ + q₂) zóna varu;  Q_II = ṁ·q₃ zóna přehřátí', 'Q = ṁ·q;  Q_I = ṁ·(q₁ + q₂) boiling zone;  Q_II = ṁ·q₃ superheating zone'),
      result: (
        <span className="stack">
          <span>Q = <Qty v={d.Q_kW} unit="kW" src="VYPOCET" d={3} /></span>
          <span>Q_I = <Qty v={d.Q_I_kW} unit="kW" src="VYPOCET" d={3} /></span>
          <span>Q_II = <Qty v={d.Q_II_kW} unit="kW" src="VYPOCET" d={3} /></span>
        </span>
      ),
      note: tr('Ustálený otevřený systém, bez práce; změny kinetické a potenciální energie zanedbány.', 'Steady open system, no work; kinetic and potential energy changes neglected.'),
    },
    {
      n: 9,
      title: tr('Střední měrné teplo (informativně)', 'Mean specific heat (informative)'),
      formula: 'c_p,l = q₁ / (T_sat − T_in);  c_p,g = q₃ / (T_out − T_sat)',
      result: (
        <span className="stack">
          <span>
            c_p,l ={' '}
            {d.cp_l_mean_kJ_kgK === null ? (
              <span className="muted" data-narrative="">
                {tr('neuvádí se (|T_sat − T_in| < 1 K)', 'not given (|T_sat − T_in| < 1 K)')}
              </span>
            ) : (
              <Qty v={d.cp_l_mean_kJ_kgK} unit="kJ/(kg·K)" src="VYPOCET" d={3} />
            )}
          </span>
          <span>c_p,g = <Qty v={d.cp_g_mean_kJ_kgK} unit="kJ/(kg·K)" src="VYPOCET" d={3} /></span>
        </span>
      ),
    },
  ];

  return (
    <section className="card" aria-labelledby="steps-h">
      <h2 id="steps-h">{tr('Postup výpočtu krok za krokem', 'Calculation step by step')}</h2>
      <ol className="steps">
        {steps.map((s) => (
          <li key={s.n} className="step">
            <div className="step-title">{s.title}</div>
            <F>{s.formula}</F>
            {s.subst ? <div className="step-subst">{tr('dosazení', 'substitution')}: {s.subst}</div> : null}
            <div className="step-result">{s.result}</div>
            {s.note ? (
              <div className="step-note" data-narrative="">
                {s.note}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
