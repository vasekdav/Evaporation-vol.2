import { concepts, designRules, roleLabel, type ConceptRole } from '../../core/concept';
import { tr } from '../../core/i18n';
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
        {tr('Doporučení konceptu', 'Concept recommendation')} <SourceTag src="PRAXE" />
      </h2>
      <p className="note" data-narrative="">
        {tr(
          'Odůvodněné doporučení z pravidel praxe jako podklad pro analýzu rizik (HAZOP / LOPA). Není to závazný výběr – rozhodnutí patří do analýzy rizik a nabídky výrobce.',
          'A reasoned recommendation from rules of practice as input for the risk analysis (HAZOP / LOPA). It is not a binding choice – the decision belongs to the risk analysis and the manufacturer offer.',
        )}
      </p>
      <ul className="concepts" data-narrative="">
        {r.items.map((it) => {
          const c = concepts()[it.id];
          return (
            <li key={it.id} className={`concept-item ${ROLE_CLASS[it.role]}`} data-concept={it.id} data-role={it.role}>
              <div className="concept-head">
                <span className="role">{roleLabel(it.role)}</span>
                <strong>{c.name}</strong>
              </div>
              <div className="why">
                <span className="why-label">{tr('Proč', 'Why')}: </span>
                {it.why.join(' ')}
              </div>
              <div className="pros-risks">
                <div>
                  <div className="pr-h">{tr('Výhody', 'Advantages')}</div>
                  <ul>
                    {c.pros.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="pr-h">{tr('Rizika', 'Risks')}</div>
                  <ul>
                    {c.risks.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="pr-h">{tr('Co hlídat', 'What to watch')}</div>
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
          <strong>{tr('Zvaž tři varianty.', 'Consider three variants.')}</strong> {r.threeVariants.why}
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
        <summary>{tr('Pravidla návrhu (kap. 6.2)', 'Design rules (ch. 6.2)')}</summary>
        <ul>
          {designRules().map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
