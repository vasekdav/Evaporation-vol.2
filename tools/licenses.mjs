// Soupis licencí knihoven, které jsou součástí buildu (npm ls --omit=dev).
// Výstup: public/third-party-licenses.txt (Vite ho zkopíruje do dist/).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const tree = JSON.parse(execFileSync('npm', ['ls', '--omit=dev', '--all', '--json'], { cwd: root, encoding: 'utf-8' }));
const seen = new Map();
(function walk(deps) {
  for (const [name, d] of Object.entries(deps ?? {})) {
    const key = `${name}@${d.version}`;
    if (seen.has(key) || !d.version) continue;
    let license = 'neuvedeno';
    try {
      const pj = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf-8'));
      license = typeof pj.license === 'string' ? pj.license : (pj.license?.type ?? license);
    } catch {
      /* vnořená instalace – licence z kořenového balíčku nedostupná */
    }
    seen.set(key, license);
    walk(d.dependencies);
  }
})(tree.dependencies);
const lines = [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, l]) => `${k}  ${l}`);
const text =
  'Knihovny třetích stran obsažené v aplikaci Odpařovač (generováno tools/licenses.mjs)\n' +
  'Písmo Roboto (součást pdfmake): Apache License 2.0. Vlastnosti látek: tabulky vygenerované z CoolProp 7.2.0 (MIT).\n\n' +
  lines.join('\n') +
  '\n';
if (!existsSync(join(root, 'public'))) mkdirSync(join(root, 'public'));
writeFileSync(join(root, 'public', 'third-party-licenses.txt'), text);
console.log(`licence: ${lines.length} balíčků → public/third-party-licenses.txt`);
