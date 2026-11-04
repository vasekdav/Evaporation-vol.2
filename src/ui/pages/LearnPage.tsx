import { useId, useMemo, useState } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import type { Evaluation } from '../../core/evaluate';
import { computeDuty } from '../../core/duty';
import { FLUID_POLICY } from '../../core/fluids';
import { fmt } from '../../core/format';
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
        <h2>Proč ne kW</h2>
        <p>{APP.notKw}</p>
        <p>
          Výkon v kW určují jen látka, tlak a teploty kapaliny a plynu – je stejný v létě i v mrazu. Kolik tepla odpařovač skutečně
          dostane ze vzduchu, závisí na ploše, rozdílu teplot a na tom, jak moc je plocha namrzlá. Proto výrobci udávají kapacitu v
          Nm³/h za definovaných katalogových podmínek a na lokalitu ji přepočítávají vlastními daty.
        </p>
      </section>

      <div className="three-col">
        <section className="card col-calc">
          <h3>Výpočet</h3>
          <p className="col-sub">fyzika – přesně</p>
          <ul>
            <li>Q = ṁ · (h_out − h_in) ze stavové rovnice, přesnost ≤ 0,1 %.</li>
            <li>Rozklad na ohřev kapaliny, var a přehřátí; zóny I a II.</li>
            <li>Ideální dolní mez velikosti z modelu konstantního U – vždy optimistická.</li>
          </ul>
        </section>
        <section className="card col-practice">
          <h3>Praxe</h3>
          <p className="col-sub">pravidla a údaje výrobců</p>
          <ul>
            <li>Výrobce udává Nm³/h za katalogových podmínek (např. 20 °C, 75 % RH, 8 h provozu).</li>
            <li>Rezerva 1,2–1,5× průtoku jen při přiblížení ≈ 10 K; při menším přiblížení výrazně víc.</li>
            <li>24/7 → dvě přepínané větve; TSL nad mezí potrubí s rezervou; TSL se nikdy nesnižuje.</li>
          </ul>
        </section>
        <section className="card col-reality">
          <h3>Realita</h3>
          <p className="col-sub">co model nezná</p>
          <ul>
            <li>Námraza pokryje celou plochu a zhorší přestup tepla – nejhorší je konec provozního cyklu.</li>
            <li>V mrazu chybí latentní teplo vlhkosti, které vzduch v létě odevzdá vymrzáním.</li>
            <li>Studený vzduch se drží u jednotky a u budov. Kolik to dělá, ví jen výrobce z měření – aplikace si koeficient nevymýšlí.</li>
          </ul>
        </section>
      </div>

      <section className="card" aria-labelledby="learn-model">
        <h2 id="learn-model">Interaktivní model</h2>
        <p className="note">
          Stejný případ jako na stránce Výpočet ({FLUID_POLICY[ev.input.fluid].formula}, stejný průtok, tlak a kapalina). Posuň teplotu
          vzduchu a výstupní teplotu a sleduj, co se mění.
        </p>
        {!d || !basis ? (
          <p className="big-invalid">Interaktivní model potřebuje platné vstupy na stránce Výpočet.</p>
        ) : (
          <>
            <div className="sliders">
              <label htmlFor={idAir}>
                Teplota vzduchu: <strong>{fmt(Tair, 0)} °C</strong>
              </label>
              <input id={idAir} type="range" min={-25} max={25} step={1} value={Tair} onChange={(e) => setTair(Number(e.target.value))} />
              <label htmlFor={idOut}>
                Výstupní teplota plynu: <strong>{fmt(Tout, 0)} °C</strong>
              </label>
              <input id={idOut} type="range" min={-50} max={10} step={1} value={Tout} onChange={(e) => setTout(Number(e.target.value))} />
            </div>
            <div className="stats">
              <div className="stat col-calc-b">
                <div className="stat-label">Výkon Q – nezávisí na teplotě vzduchu</div>
                <div className="stat-value" data-testid="learn-Q">
                  {model ? <Qty v={model.Q} unit="kW" src="VYPOCET" /> : '–'}
                </div>
              </div>
              <div className="stat col-calc-b">
                <div className="stat-label">Ideální ekvivalent N_eq (k = 1)</div>
                <div className="stat-value" data-testid="learn-Neq">
                  {model?.sizing.ok ? (
                    <Qty v={model.sizing.N_eq_Nm3_h} unit="Nm³/h kat." src="VYPOCET" d={0} />
                  ) : (
                    <span className="muted">nelze – vzduch není teplejší než výstupní plyn</span>
                  )}
                </div>
              </div>
              <div className="stat col-reality-b">
                <div className="stat-label">Voda ve vzduchu při {fmt(RH, 0)} % RH</div>
                <div className="stat-value">
                  <Qty v={xAir} unit="g/kg" src="VYPOCET" />
                  {xKat !== null ? (
                    <span className="sub muted">
                      za katalogových podmínek <Qty v={xKat} unit="g/kg" src="VYPOCET" />
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <p className="note">
              Každý vymrzlý gram vody odevzdá asi <Qty v={LATENT_KJ_PER_G} unit="kJ/g" src="VYPOCET" d={1} /> latentního tepla. Při
              nízké teplotě je ve vzduchu vody málo, takže tento příspěvek chybí – skutečná potřebná plocha je větší, než ukazuje N_eq.
              O kolik, určí jen přepočet výrobce.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
