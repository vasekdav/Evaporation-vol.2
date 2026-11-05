/**
 * Společné nastavení testů: výchozí jazyk čeština (testy ověřují české texty).
 * Prohlížeč v jsdom hlásí en-US, proto se jazyk prohlížeče přepíše na cs-CZ.
 */
import { beforeEach } from 'vitest';
import { setLang } from '../src/core/i18n';

if (typeof window !== 'undefined') {
  Object.defineProperty(window.navigator, 'language', { value: 'cs-CZ', configurable: true });
}

beforeEach(() => setLang('cs'));
