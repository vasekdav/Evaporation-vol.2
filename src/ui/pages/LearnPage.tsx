import { useId, useMemo, useState } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import type { Evaluation } from '../../core/evaluate';
import { computeDuty } from '../../core/duty';
import { FLUID_POLICY } from '../../core/fluids';
import { fmt } from '../../core/format';
import { tr } from '../../core/i18n';
import { getProvider } from '../../core/properties';
import { absoluteHumidity_g_kg, LATENT_KJ_PER_G } from '../../core/psychro';
import { sizeBranch } from '../../core/sizing';
import { Qty } from '../components/Qty';
import { APP } from '../texts';

/**
 * Výuková část „Proč ne kW“ a „Výpočet × praxe × realita“ (kap. 8 bod 7).
 * Interaktivní model používá stejné jádro; „realita“ je jen kvalitativní –
 * aplikace si koeficient námrazy nevymýšlí.
 */
export function LearnPage({ ev, basis }: { ev: Evaluation; basis: CatalogBasis | undefined }) {
  const idAir = useId();
  const idOut = useId();
  const d = ev.duty;
  const [Tair, setTair] = useState(() => Math.round(Math.max(-25, Math.min(25, ev.T_des_C ?? 0))));
  const [Tout, setTout] = useState(() => Math.round(Math.max(-50, Math.min(10, ev.input.T_out_C))));

  const model = useMemo(() => {
    if (!d || !basis) return null;
    const props = getProvider(ev.input.fluid);
    try {
      const duty = computeDuty(props, { Vn_Nm3_h: d.Vn_Nm3_h, p_bar_a: d.p_bar_a, liquid: ev.input.liquid, T_out_C: Tout });
      const s = sizeBranch(props, duty, basis, Tair, 1);
      return { Q: duty.Q_kW, sizing: s };
    } catch {
      return null;
    }
  }, [d, basis, ev.input.fluid, ev.input.liquid, Tair, Tout]);

  const RH = ev.input.RH_winter_pct;
  const xAir = absoluteHumidity_g_kg(Tair, RH);
  const xKat = basis ? absoluteHumidity_g_kg(basis.T_amb_C, basis.RH_pct ?? 75) : null;

  return (
    <div className="info-page learn">
      <section className="card">
        <h2>{tr('Proč ne kW', 'Why not kW')}</h2>
        <p>{APP.notKw}</p>
        <p>
          {tr(
            'Výkon v kW určují jen látka, tlak a teploty kapaliny a plynu – je stejný v létě i v mrazu. Kolik tepla odpařovač skutečně dostane ze vzduchu, závisí na ploše, rozdílu teplot a na tom, jak moc je plocha namrzlá. Proto výrobci udávají kapacitu v Nm³/h za definovaných katalogových podmínek a na lokalitu ji přepočítávají vlastními daty.',
            'The duty in kW is set only by the fluid, pressure and the liquid and gas temperatures – it is the same in summer and in frost. How much heat the vaporizer actually gets from the air depends on the surface area, the temperature difference and how iced the surface is. That is why manufacturers state capacity in Nm³/h at defined catalogue conditions and recalculate it for the site with their own data.',
          )}
        </p>
      </section>

      <div className="three-col">
        <section className="card col-calc">
          <h3>{tr('Výpočet', 'Calculation')}</h3>
          <p className="col-sub">{tr('fyzika – přesně', 'physics – exact')}</p>
          <ul>
            <li>{tr('Q = ṁ · (h_out − h_in) ze stavové rovnice, přesnost ≤ 0,1 %.', 'Q = ṁ · (h_out − h_in) from the equation of state, accuracy ≤ 0.1 %.')}</li>
            <li>{tr('Rozklad na ohřev kapaliny, var a přehřátí; zóny I a II.', 'Breakdown into liquid warming, boiling and superheating; zones I and II.')}</li>
            <li>{tr('Ideální dolní mez velikosti z modelu konstantního U – vždy optimistická.', 'Ideal lower size bound from the constant-U model – always optimistic.')}</li>
          </ul>
        </section>
        <section className="card col-practice">
          <h3>{tr('Praxe', 'Practice')}</h3>
          <p className="col-sub">{tr('pravidla a údaje výrobců', 'rules and manufacturer data')}</p>
          <ul>
            <li>{tr('Výrobce udává Nm³/h za katalogových podmínek (např. 20 °C, 75 % RH, 8 h provozu).', 'The manufacturer states Nm³/h at catalogue conditions (e.g. 20 °C, 75 % RH, 8 h of operation).')}</li>
            <li>{tr('Rezerva 1,2–1,5× průtoku jen při přiblížení ≈ 10 K; při menším přiblížení výrazně víc.', 'A reserve of 1.2–1.5× flow only at an approach of ≈ 10 K; considerably more at a smaller approach.')}</li>
            <li>{tr('24/7 → dvě přepínané větve; TSL nad mezí potrubí s rezervou; TSL se nikdy nesnižuje.', '24/7 → two switched branches; TSL above the piping limit with margin; TSL is never lowered.')}</li>
          </ul>
        </section>
        <section className="card col-reality">
          <h3>{tr('Realita', 'Reality')}</h3>
          <p className="col-sub">{tr('co model nezná', 'what the model does not know')}</p>
          <ul>
            <li>{tr('Námraza pokryje celou plochu a zhorší přestup tepla – nejhorší je konec provozního cyklu.', 'Frost covers the whole surface and impairs heat transfer – the end of the operating cycle is the worst.')}</li>
            <li>{tr('V mrazu chybí latentní teplo vlhkosti, které vzduch v létě odevzdá vymrzáním.', 'In frost the latent heat of moisture, which the air gives up by freezing out in summer, is missing.')}</li>
            <li>{tr('Nejrychleji odpařovač zarůstá ledem kolem 0 až −5 °C při vysoké vlhkosti a v mlze (zkušenost z praxe).', 'A vaporizer ices up fastest around 0 to −5 °C at high humidity and in fog (field experience).')}</li>
            <li>{tr('Studený vzduch se drží u jednotky a u budov. Kolik to dělá, ví jen výrobce z měření – aplikace si koeficient nevymýšlí.', 'Cold air lingers around the unit and buildings. How much this matters only the manufacturer knows from measurements – the application does not invent a factor.')}</li>
          </ul>
        </section>
      </div>

      <section className="card" aria-labelledby="learn-model">
        <h2 id="learn-model">{tr('Interaktivní model', 'Interactive model')}</h2>
        <p className="note">
          {tr(
            `Stejný případ jako na stránce Výpočet (${FLUID_POLICY[ev.input.fluid].formula}, stejný průtok, tlak a kapalina). Posuň teplotu vzduchu a výstupní teplotu a sleduj, co se mění.`,
            `The same case as on the Calculation page (${FLUID_POLICY[ev.input.fluid].formula}, same flow, pressure and liquid). Move the air temperature and outlet temperature and watch what changes.`,
          )}
        </p>
        {!d || !basis ? (
          <p className="big-invalid">{tr('Interaktivní model potřebuje platné vstupy na stránce Výpočet.', 'The interactive model needs valid inputs on the Calculation page.')}</p>
        ) : (
          <>
            <div className="sliders">
              <label htmlFor={idAir}>
                {tr('Teplota vzduchu', 'Air temperature')}: <strong>{fmt(Tair, 0)} °C</strong>
              </label>
              <input id={idAir} type="range" min={-25} max={25} step={1} value={Tair} onChange={(e) => setTair(Number(e.target.value))} />
              <label htmlFor={idOut}>
                {tr('Výstupní teplota plynu', 'Gas outlet temperature')}: <strong>{fmt(Tout, 0)} °C</strong>
              </label>
              <input id={idOut} type="range" min={-50} max={10} step={1} value={Tout} onChange={(e) => setTout(Number(e.target.value))} />
            </div>
            <div className="stats">
              <div className="stat col-calc-b">
                <div className="stat-label">{tr('Výkon Q – nezávisí na teplotě vzduchu', 'Duty Q – independent of air temperature')}</div>
                <div className="stat-value" data-testid="learn-Q">
                  {model ? <Qty v={model.Q} unit="kW" src="VYPOCET" /> : '–'}
                </div>
              </div>
              <div className="stat col-calc-b">
                <div className="stat-label">{tr('Ideální ekvivalent N_eq (k = 1)', 'Ideal equivalent N_eq (k = 1)')}</div>
                <div className="stat-value" data-testid="learn-Neq">
                  {model?.sizing.ok ? (
                    <Qty v={model.sizing.N_eq_Nm3_h} unit={tr('Nm³/h kat.', 'Nm³/h cat.')} src="VYPOCET" d={0} />
                  ) : (
                    <span className="muted">{tr('nelze – vzduch není teplejší než výstupní plyn', 'n/a – the air is not warmer than the outlet gas')}</span>
                  )}
                </div>
              </div>
              <div className="stat col-reality-b">
                <div className="stat-label">
                  {tr('Voda ve vzduchu při', 'Water in air at')} {fmt(RH, 0)} % RH
                </div>
                <div className="stat-value">
                  <Qty v={xAir} unit="g/kg" src="VYPOCET" />
                  {xKat !== null ? (
                    <span className="sub muted">
                      {tr('za katalogových podmínek', 'at catalogue conditions')} <Qty v={xKat} unit="g/kg" src="VYPOCET" />
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <p className="note">
              {tr('Každý vymrzlý gram vody odevzdá asi', 'Each gram of water frozen out releases about')}{' '}
              <Qty v={LATENT_KJ_PER_G} unit="kJ/g" src="VYPOCET" d={1} />{' '}
              {tr(
                'latentního tepla. Při nízké teplotě je ve vzduchu vody málo, takže tento příspěvek chybí – skutečná potřebná plocha je větší, než ukazuje N_eq. O kolik, určí jen přepočet výrobce.',
                'of latent heat. At low temperature there is little water in the air, so this contribution is missing – the real required area is larger than N_eq shows. By how much, only the manufacturer recalculation can tell.',
              )}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
