/**
 * Psychrometrie – vysvětlující model (kap. 5.5). Nepoužívá se pro dimenzování.
 *
 *   x [g/kg] = 622·φ·e_s / (p − φ·e_s),   p = 1013,25 hPa
 *   Magnus: nad vodou (T ≥ 0 °C) e_s = 6,112·exp(17,62·T/(243,12+T)) hPa
 *           nad ledem (T < 0 °C) e_s = 6,112·exp(22,46·T/(272,62+T)) hPa
 */

export const P_AIR_HPA = 1013.25;
/** Latentní potenciál vymrzlé vody ≈ sublimační teplo ~2,8 kJ/g (2,834 kJ/g při 0 °C). */
export const LATENT_KJ_PER_G = 2.834;

export function saturationPressure_hPa(T_C: number): number {
  return T_C >= 0
    ? 6.112 * Math.exp((17.62 * T_C) / (243.12 + T_C))
    : 6.112 * Math.exp((22.46 * T_C) / (272.62 + T_C));
}

/** Absolutní vlhkost x [g vody / kg suchého vzduchu]. */
export function absoluteHumidity_g_kg(T_C: number, RH_pct: number, p_hPa: number = P_AIR_HPA): number {
  const e = (RH_pct / 100) * saturationPressure_hPa(T_C);
  return (622 * e) / (p_hPa - e);
}

/** Latentní teplo uvolněné vymrznutím Δx gramů vody na kg vzduchu [kJ/kg vzduchu]. */
export function latentPotential_kJ_kg(dx_g_kg: number): number {
  return dx_g_kg * LATENT_KJ_PER_G;
}
