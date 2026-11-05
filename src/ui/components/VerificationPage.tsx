import { useMemo } from 'react';
import { fmt } from '../../core/format';
import { FLUID_POLICY } from '../../core/fluids';
import { linLoxLesson, runVerification, type NumericRow, type VerificationRow } from '../../core/verification';
import { Qty, SourceTag } from './Qty';

const fluidLabel = (f: VerificationRow['fluid']) => (f === 'společné' ? 'společné' : FLUID_POLICY[f].formula);

function decimalsFor(ref: number): number {
  const s = String(ref);
  const i = s.indexOf('.');
  return i < 0 ? 0 : Math.min(6, s.length - i - 1);
}

function Deviation({ r }: { r: NumericRow }) {
  if (r.tol.kind === 'rel') {
    return (
      <>
        <Qty v={r.deviation * 100} unit="%" src="VYPOCET" d={4} signed /> <span className="muted" data-narrative="">≤ ±{fmt(r.tol.value * 100, 2)} %</span>
      </>
    );
  }
  const dec = Math.max(4, Math.ceil(-Math.log10(r.tol.value)) + 1);
  return (
    <>
      <Qty v={r.deviation} unit={r.unit} src="VYPOCET" d={dec} signed />{' '}
      <span className="muted" data-narrative="">
        ≤ ±{fmt(r.tol.value, r.tol.value < 0.001 ? 7 : 3)} {r.unit}
      </span>
    </>
  );
}

/** Stránka Ověření: referenční případy kap. 9 s aktuální odchylkou + poučný příklad LIN/LOX. */
export function VerificationPage() {
  const rows = useMemo(runVerification, []);
  const lesson = useMemo(linLoxLesson, []);
  const failed = rows.filter((r) => !r.pass);
  const groups = [...new Set(rows.map((r) => `${r.group}`))];

  return (
    <div className="verification" data-results="">
      <div className={`status ${failed.length ? 'st-invalid' : 'st-ok'}`} role="status" data-testid="verify-status" data-narrative="">
        {failed.length
          ? `NEPROŠLO ${failed.length} z ${rows.length} referenčních případů`
          : `Všech ${rows.length} referenčních případů kap. 9 prošlo`}
      </div>
      <section className="card">
        <h2>Referenční případy (kap. 9)</h2>
        <p className="note" data-narrative="">
          Reference: CoolProp 7.2.0, h = 0 pro nasycenou kapalinu při 1,01325 bar, V̇n = 1000 Nm³/h. Tolerance výkonu ±0,1 %,
          teplot ±0,05 K, entalpií ±0,02 kJ/kg. Stejné případy kontrolují automatické testy; CI spadne při odchylce nad toleranci.
        </p>
        {groups.map((g) => (
          <div key={g} className="table-scroll">
            <table className="verify-table">
              <caption>{g}</caption>
              <thead>
                <tr>
                  <th scope="col">Stav</th>
                  <th scope="col">Látka</th>
                  <th scope="col">Případ</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Aplikace</th>
                  <th scope="col">Odchylka / tolerance</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.group === g)
                  .map((r, i) => (
                    <tr key={`${r.fluid}-${r.name}-${i}`} className={r.pass ? 'pass' : 'fail'}>
                      <td className="verdict">{r.pass ? '✓ OK' : '✗ CHYBA'}</td>
                      <td>{fluidLabel(r.fluid)}</td>
                      <td data-narrative="">{r.name}</td>
                      {r.type === 'num' ? (
                        <>
                          <td>
                            <Qty v={r.ref} unit={r.unit} src="VYPOCET" d={decimalsFor(r.ref)} />
                          </td>
                          <td>
                            <Qty v={r.actual} unit={r.unit} src="VYPOCET" d={Math.max(3, decimalsFor(r.ref) + 1)} />
                          </td>
                          <td>
                            <Deviation r={r} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td data-narrative="">{r.expected}</td>
                          <td data-narrative="">{r.actual}</td>
                          <td>–</td>
                        </>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className="note" data-narrative="">
          Přesnost tabulek v celém rozsahu dokládá test se 3000 náhodnými body na látku přímo z CoolProp (max. odchylka výkonu
          kolem 0,02 %, T_sat pod 0,01 K).
        </p>
      </section>

      {lesson ? (
        <section className="card">
          <h2>Poučný příklad: model konstantního U není katalog</h2>
          <p data-narrative="">
            Fyzika na 1 Nm³/h dává poměr potřebného UA kyslíku a dusíku za katalogových podmínek Chart SuperGap EU:
          </p>
          <p className="lesson-eq">
            UA₁(O₂) / UA₁(N₂) = <Qty v={lesson.ua1_O2} unit="W/K" src="VYPOCET" d={4} /> /{' '}
            <Qty v={lesson.ua1_N2} unit="W/K" src="VYPOCET" d={4} /> = <Qty v={lesson.physicsRatio} unit="–" src="VYPOCET" d={3} />
          </p>
          <p data-narrative="">
            Model konstantního U by tedy čekal, že stejný odpařovač zvládne v dusíku asi o 5 % víc Nm³/h než v kyslíku. Katalog
            udává poměr LIN/LOX {fmt(lesson.catalogMin, 3)}–{fmt(lesson.catalogMax, 3)}. Rozdíl ukazuje, že výrobce do hodnocení
            zahrnuje i vlastní zkušenostní data. Kapacity LIN a LOX se proto mezi sebou nepřepočítávají poměrem tepelné potřeby –
            vždy se použije katalogová hodnota pro danou látku.
          </p>
          <div className="table-scroll">
            <table>
              <caption>
                Chart SuperGap EU <SourceTag src="VYROBCE" />
              </caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">LOX</th>
                  <th scope="col">LIN</th>
                  <th scope="col">LIN / LOX</th>
                </tr>
              </thead>
              <tbody>
                {lesson.models.map((m) => (
                  <tr key={m.model}>
                    <td data-narrative="">{m.model}</td>
                    <td>
                      <Qty v={m.LOX} unit="Nm³/h" src="VYROBCE" d={0} />
                    </td>
                    <td>
                      <Qty v={m.LIN} unit="Nm³/h" src="VYROBCE" d={0} />
                    </td>
                    <td>
                      <Qty v={m.ratio} unit="–" src="VYROBCE" d={3} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note" data-narrative="">
            Pozn.: zadání uvádí rozsah ≈ 1,085–1,087; z tabulky modelů vychází {fmt(lesson.catalogMin, 3)}–{fmt(lesson.catalogMax, 3)}.
          </p>
        </section>
      ) : null}
    </div>
  );
}
