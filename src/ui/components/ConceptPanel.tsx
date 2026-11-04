import { CONCEPTS, DESIGN_RULES, type ConceptRole } from '../../core/concept';
import type { Evaluation } from '../../core/evaluate';
import { SourceTag } from './Qty';

const ROLE_CLASS: Record<ConceptRole, string> = {
  doporučeno: 'role-main',
  doplněk: 'role-add',
  zvážit: 'role-alt',
};

/** Doporučení konceptu s odůvodněním (kap. 6.3). Vše PRAXE. */
export function ConceptPanel({ ev }: { ev: Evaluation }) {
  const r = ev.concept;
  if (!r) return null;
  return (
    <section className="card concept" aria-labelledby="concept-h">
      <h2 id="concept-h">
        Doporučení konceptu <SourceTag src="PRAXE" />
      </h2>
      <p className="note" data-narrative="">
        Odůvodněné doporučení z pravidel praxe jako podklad pro analýzu rizik (HAZOP / LOPA). Není to závazný výběr – rozhodnutí
        patří do analýzy rizik a nabídky výrobce.
      </p>
      <ul className="concepts" data-narrative="">
        {r.items.map((it) => {
          const c = CONCEPTS[it.id];
          return (
            <li key={it.id} className={`concept-item ${ROLE_CLASS[it.role]}`} data-concept={it.id} data-role={it.role}>
              <div className="concept-head">
                <span className="role">{it.role}</span>
                <strong>{c.name}</strong>
              </div>
              <div className="why">
                <span className="why-label">Proč: </span>
                {it.why.join(' ')}
              </div>
              <div className="pros-risks">
                <div>
                  <div className="pr-h">Výhody</div>
                  <ul>
                    {c.pros.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="pr-h">Rizika</div>
                  <ul>
                    {c.risks.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="pr-h">Co hlídat</div>
                  <ul>
                    {c.watch.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {r.threeVariants ? (
        <div className="variants" data-narrative="" data-testid="variants">
          <strong>Zvaž tři varianty.</strong> {r.threeVariants.why}
          <ol type="a">
            {r.threeVariants.variants.map((v) => (
              <li key={v.key}>{v.text}</li>
            ))}
          </ol>
          <em>{r.threeVariants.note}</em>
        </div>
      ) : null}
      {r.notes.length ? (
        <ul className="concept-notes" data-narrative="">
          {r.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      <details className="rules" data-narrative="">
        <summary>Pravidla návrhu (kap. 6.2)</summary>
        <ul>
          {DESIGN_RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
