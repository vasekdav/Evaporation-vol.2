#!/usr/bin/env python3
"""
Generátor tabulek vlastností látek z CoolProp (verze ZAFIXOVÁNA na 7.2.0).

Výstupy:
  src/data/properties/<FLUID>.json            tabulky pro runtime (TableProvider)
  test/fixtures/coolprop-validation-<FLUID>.json  náhodné body přímo z CoolProp
                                                  pro test přesnosti tabulek

Referenční stav entalpie: nasycená kapalina při 1,01325 bar má h = 0.

Spuštění:
  pip install CoolProp==7.2.0
  python3 tools/gen_tables.py            # zapíše soubory
  python3 tools/gen_tables.py --check    # jen porovná s uloženými (pro CI)

Mřížky:
  Základ podle zadání (kap. 3): tlak 0,5 bar do 20 bar a, nad 20 bar a 1 bar;
  plyn -60 až +40 °C po 5 K. Kde lineární interpolace nedosáhne tolerance
  (Q ≤ 0,1 %, T ≤ 0,05 K), je mřížka zhuštěná (viz REFINE v definici látek).
  Kapalina: přímá 2D tabulka h_l(T, Δp), Δp = p − p_sat(T) ≥ 0. Je to obecná
  forma korekce h_l = h_l,sat(T) + (∂h/∂p)_T·Δp ze zadání; lineární korekce
  u N2 blízko kritického bodu nedosahuje požadované přesnosti.
"""
from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

import CoolProp
import CoolProp.CoolProp as CPmod
from CoolProp.CoolProp import PropsSI

COOLPROP_VERSION = "7.2.0"
if CoolProp.__version__ != COOLPROP_VERSION:
    sys.exit(f"Vyžadován CoolProp {COOLPROP_VERSION}, nalezen {CoolProp.__version__}")

ROOT = Path(__file__).resolve().parent.parent
OUT_DATA = ROOT / "src" / "data" / "properties"
OUT_FIX = ROOT / "test" / "fixtures"

K0 = 273.15
P_ATM_PA = 101325.0
T_NORMAL_K = 273.15  # normální podmínky: 0 °C, 1,01325 bar


def frange(a: float, b: float, step: float) -> list[float]:
    n = int(round((b - a) / step))
    return [round(a + i * step, 6) for i in range(n + 1)]


def merge_grid(*parts: list[float]) -> list[float]:
    s = sorted({round(x, 6) for part in parts for x in part})
    return s


# Definice látek. Rozsahy jsou politika aplikace (kap. 3), ne fyzika.
FLUIDS = {
    "O2": {
        "coolprop": "Oxygen",
        "name_cs": "kyslík",
        "p_min_bar_a": 1.0,
        "p_max_bar_a": 40.0,
        "T_liq_min_C": -218.0,
        "p_grid": lambda: merge_grid(
            frange(1.0, 20.0, 0.5),
            frange(20.0, 40.0, 1.0),
            frange(1.0, 3.0, 0.1),   # zhuštění: zakřivení T_sat(p) při nízkém tlaku
            frange(3.0, 8.0, 0.25),
        ),
        "liq_T_grid": lambda Tmax: merge_grid(
            frange(-218.0, math.ceil(Tmax), 1.0),
            frange(math.ceil(Tmax) - 10.0, math.ceil(Tmax), 0.25),
        ),
        "liq_dp_grid": lambda: merge_grid(frange(0.0, 40.0, 1.0)),
    },
    "N2": {
        "coolprop": "Nitrogen",
        "name_cs": "dusík",
        "p_min_bar_a": 1.0,
        "p_max_bar_a": 32.0,
        "T_liq_min_C": -209.0,
        "p_grid": lambda: merge_grid(
            frange(1.0, 20.0, 0.5),
            frange(20.0, 32.0, 1.0),
            frange(1.0, 3.0, 0.1),    # zakřivení T_sat(p) při nízkém tlaku
            frange(3.0, 8.0, 0.25),
            frange(24.0, 32.0, 0.25),  # blízko kritického bodu (33,96 bar)
            frange(28.0, 32.0, 0.1),
        ),
        "liq_T_grid": lambda Tmax: merge_grid(
            frange(-209.0, math.ceil(Tmax), 1.0),
            frange(math.ceil(Tmax) - 10.0, math.ceil(Tmax), 0.25),
            frange(math.ceil(Tmax) - 3.0, math.ceil(Tmax), 0.1),  # blízko kritického bodu
        ),
        "liq_dp_grid": lambda: merge_grid(
            frange(0.0, 1.0, 0.1), frange(1.0, 4.0, 0.25), frange(4.0, 32.0, 1.0)
        ),
    },
    # Fáze 5: argon. Kritický bod 48,63 bar / −122,46 °C; rozsah 1–40 bar a (odstup jako u O₂).
    "Ar": {
        "coolprop": "Argon",
        "name_cs": "argon",
        "p_min_bar_a": 1.0,
        "p_max_bar_a": 40.0,
        "T_liq_min_C": -189.0,  # trojný bod −189,34 °C
        "p_grid": lambda: merge_grid(
            frange(1.0, 20.0, 0.5),
            frange(20.0, 40.0, 1.0),
            frange(1.0, 3.0, 0.1),
            frange(3.0, 8.0, 0.25),
        ),
        "liq_T_grid": lambda Tmax: merge_grid(
            frange(-189.0, math.ceil(Tmax), 1.0),
            frange(math.ceil(Tmax) - 10.0, math.ceil(Tmax), 0.25),
        ),
        "liq_dp_grid": lambda: merge_grid(frange(0.0, 40.0, 1.0)),
    },
}

GAS_T_GRID_C = frange(-60.0, 40.0, 5.0)


class Fluid:
    def __init__(self, key: str):
        self.key = key
        self.d = FLUIDS[key]
        self.cp = self.d["coolprop"]
        self.h_ref = PropsSI("H", "P", P_ATM_PA, "Q", 0, self.cp)

    def h(self, p_pa: float, T_K: float) -> float:
        return (PropsSI("H", "P", p_pa, "T", T_K, self.cp) - self.h_ref) / 1e3

    def rho(self, p_pa: float, T_K: float) -> float:
        return PropsSI("D", "P", p_pa, "T", T_K, self.cp)

    def sat_p(self, p_pa: float, q: int, out: str) -> float:
        v = PropsSI(out, "P", p_pa, "Q", q, self.cp)
        return (v - self.h_ref) / 1e3 if out == "H" else v

    def sat_T(self, T_K: float, q: int, out: str) -> float:
        v = PropsSI(out, "T", T_K, "Q", q, self.cp)
        return (v - self.h_ref) / 1e3 if out == "H" else v

    def liquid_h(self, p_pa: float, T_K: float) -> float:
        """h kapaliny; na saturaci přes Q=0 (PT flash je tam nejednoznačný)."""
        ps = self.sat_T(T_K, 0, "P")
        if abs(p_pa - ps) < 1.0:
            return self.sat_T(T_K, 0, "H")
        return self.h(p_pa, T_K)

    def liquid_rho(self, p_pa: float, T_K: float) -> float:
        ps = self.sat_T(T_K, 0, "P")
        if abs(p_pa - ps) < 1.0:
            return self.sat_T(T_K, 0, "D")
        return self.rho(p_pa, T_K)


def r6(x: float) -> float:
    return float(f"{x:.6f}")


def r9(x: float) -> float:
    return float(f"{x:.9g}")


def build_tables(key: str) -> dict:
    f = Fluid(key)
    d = f.d
    cp = f.cp
    p_grid = d["p_grid"]()
    assert p_grid[0] == d["p_min_bar_a"] and p_grid[-1] == d["p_max_bar_a"]

    # --- nasycení podle tlaku
    sat = {"p_bar_a": p_grid, "T_C": [], "h_l": [], "h_v": [], "rho_l": [], "T_melt_C": []}
    AS = CPmod.AbstractState("HEOS", cp)
    for p in p_grid:
        pa = p * 1e5
        sat["T_C"].append(r6(PropsSI("T", "P", pa, "Q", 0, cp) - K0))
        sat["h_l"].append(r6(f.sat_p(pa, 0, "H")))
        sat["h_v"].append(r6(f.sat_p(pa, 1, "H")))
        sat["rho_l"].append(r6(f.sat_p(pa, 0, "D")))
        # křivka tání: pod ní je látka pevná (u Ar nad ~14 bar a leží nad trojným bodem)
        sat["T_melt_C"].append(r6(AS.melting_line(CPmod.iT, CPmod.iP, pa) - K0))

    # --- plyn h(p, T)
    gas = {"p_bar_a": p_grid, "T_C": GAS_T_GRID_C, "h": []}
    for p in p_grid:
        gas["h"].append([r6(f.h(p * 1e5, T + K0)) for T in GAS_T_GRID_C])

    # --- kapalina h_l(T, Δp)
    T_sat_max_C = PropsSI("T", "P", d["p_max_bar_a"] * 1e5, "Q", 0, cp) - K0
    Tc_C = PropsSI("Tcrit", cp) - K0
    T_grid = d["liq_T_grid"](T_sat_max_C)
    assert T_grid[-1] < Tc_C - 0.5, "tabulka kapaliny musí zůstat pod kritickou teplotou"
    dp_grid = d["liq_dp_grid"]()
    liq = {"T_C": T_grid, "dp_bar": dp_grid, "p_sat_bar_a": [], "h": [], "rho": []}
    for T in T_grid:
        TK = T + K0
        ps = f.sat_T(TK, 0, "P")
        liq["p_sat_bar_a"].append(r9(ps / 1e5))
        hrow, rrow = [], []
        for dp in dp_grid:
            pa = ps + dp * 1e5
            hrow.append(r6(f.liquid_h(pa, TK)))
            rrow.append(r6(f.liquid_rho(pa, TK)))
        liq["h"].append(hrow)
        liq["rho"].append(rrow)

    meta = {
        "fluid": key,
        "coolprop_name": cp,
        "coolprop_version": COOLPROP_VERSION,
        "eos": None,  # doplněno níže
        "h_reference": "h = 0 pro nasycenou kapalinu při 1,01325 bar",
        "units": {"p": "bar a", "T": "°C", "h": "kJ/kg", "rho": "kg/m³"},
        "rho_n_kg_Nm3": r9(PropsSI("D", "P", P_ATM_PA, "T", T_NORMAL_K, cp)),
        "nbp_C": r6(PropsSI("T", "P", P_ATM_PA, "Q", 0, cp) - K0),
        "r_atm_kJ_kg": r6(f.sat_p(P_ATM_PA, 1, "H") - f.sat_p(P_ATM_PA, 0, "H")),
        "T_triple_C": r6(PropsSI("Ttriple", cp) - K0),
        "T_crit_C": r6(Tc_C),
        "p_crit_bar_a": r6(PropsSI("pcrit", cp) / 1e5),
        "p_min_bar_a": d["p_min_bar_a"],
        "p_max_bar_a": d["p_max_bar_a"],
        "T_liq_min_C": d["T_liq_min_C"],
        "T_gas_min_C": GAS_T_GRID_C[0],
        "T_gas_max_C": GAS_T_GRID_C[-1],
    }
    meta["eos"] = {
        "O2": "Schmidt & Wagner (1985)",
        "N2": "Span et al. (2000)",
        "Ar": "Tegeler et al. (1999)",
    }.get(key)
    return {"meta": meta, "sat": sat, "gas": gas, "liquid": liq}


def build_validation(key: str, n: int = 3000, seed: int = 20261104) -> dict:
    """Náhodné případy (p, T_out, T_in) s výkonem přímo z CoolProp, V̇n = 1000 Nm³/h."""
    f = Fluid(key)
    d = f.d
    cp = f.cp
    rng = random.Random(seed)
    rho_n = PropsSI("D", "P", P_ATM_PA, "T", T_NORMAL_K, cp)
    m = 1000.0 * rho_n / 3600.0
    pmin, pmax = d["p_min_bar_a"], d["p_max_bar_a"]
    Tlo = d["T_liq_min_C"]

    cases = []

    def add(p: float, Tout: float, Tin: float | None) -> None:
        pa = p * 1e5
        Ts = PropsSI("T", "P", pa, "Q", 0, cp) - K0
        hl = f.sat_p(pa, 0, "H")
        hv = f.sat_p(pa, 1, "H")
        if Tin is None:
            hin = hl
            rho_in = f.sat_p(pa, 0, "D")
        else:
            hin = f.liquid_h(pa, Tin + K0)
            rho_in = f.liquid_rho(pa, Tin + K0)
        hout = f.h(pa, Tout + K0)
        cases.append({
            "p": r9(p), "Tout": r9(Tout), "Tin": None if Tin is None else r9(Tin),
            "Tsat": r9(Ts), "Q": r9(m * (hout - hin)), "QI": r9(m * (hv - hin)),
            "QII": r9(m * (hout - hv)), "rhoIn": r9(rho_in),
        })

    # rohy a hrany rozsahu
    for p in (pmin, pmax, 0.5 * (pmin + pmax)):
        Ts = PropsSI("T", "P", p * 1e5, "Q", 0, cp) - K0
        for Tout in (-60.0, 40.0):
            add(p, Tout, None)
            add(p, Tout, Tlo)
            add(p, Tout, Ts - 0.02)
    # náhodné body
    while len(cases) < n:
        p = rng.uniform(pmin, pmax)
        Tout = rng.uniform(-60.0, 40.0)
        u = rng.random()
        if u < 0.25:
            Tin = None
        else:
            Ts = PropsSI("T", "P", p * 1e5, "Q", 0, cp) - K0
            if u < 0.4:  # blízko nasycení (nejtěžší oblast)
                Tin = Ts - rng.uniform(0.01, 3.0)
            else:
                Tin = rng.uniform(Tlo, Ts - 0.01)
        add(p, Tout, Tin)
    return {
        "fluid": key, "coolprop_version": COOLPROP_VERSION, "Vn_Nm3_h": 1000.0,
        "seed": seed, "cases": cases,
    }


# --------------------------------------------------------------------------- referenční případy
# Pro Ar zadání předepisuje vygenerovat referenční případy z CoolProp stejnou sadou jako
# kap. 9.1 a 9.2. Počítá se PŘÍMO ze stavové rovnice (nezávisle na tabulkách).
REFERENCE_FLUIDS = {"Ar": {"T_in": -186.0}}
CHART_BASIS = {"T_amb_C": 20.0, "p_bar_a": 15.0 + 1.01325, "approach_K": 10.0}


def _duty(f: Fluid, Vn: float, p: float, Tout: float, Tin):
    rho_n = PropsSI("D", "P", P_ATM_PA, "T", T_NORMAL_K, f.cp)
    m = Vn * rho_n / 3600.0
    pa = p * 1e5
    hl, hv = f.sat_p(pa, 0, "H"), f.sat_p(pa, 1, "H")
    hin = hl if Tin is None else f.liquid_h(pa, Tin + K0)
    hout = f.h(pa, Tout + K0)
    Ts = PropsSI("T", "P", pa, "Q", 0, f.cp) - K0
    return m, m * (hout - hin), m * (hv - hin), m * (hout - hv), Ts


def _ua(f: Fluid, Vn, p, Tair, Tout, Tin) -> float:
    _, _, QI, QII, Ts = _duty(f, Vn, p, Tout, Tin)
    dI, dO = Tair - Ts, Tair - Tout
    lmtd = (dI - dO) / math.log(dI / dO)
    return QI * 1e3 / dI + QII * 1e3 / lmtd  # W/K


def build_reference(key: str) -> dict:
    f = Fluid(key)
    cp = f.cp
    Tin = REFERENCE_FLUIDS[key]["T_in"]
    P6 = 6.01325
    pa6 = P6 * 1e5
    Ts40 = PropsSI("T", "P", 40e5, "Q", 0, cp) - K0
    Tin40 = math.floor((Ts40 - 0.3) * 10) / 10  # těsně pod nasycením, jako −124,8 °C u O₂
    props = {
        "rho_n": PropsSI("D", "P", P_ATM_PA, "T", T_NORMAL_K, cp),
        "nbp": PropsSI("T", "P", P_ATM_PA, "Q", 0, cp) - K0,
        "r_atm": f.sat_p(P_ATM_PA, 1, "H") - f.sat_p(P_ATM_PA, 0, "H"),
        "Tsat": PropsSI("T", "P", pa6, "Q", 0, cp) - K0,
        "r": f.sat_p(pa6, 1, "H") - f.sat_p(pa6, 0, "H"),
        "hl": f.sat_p(pa6, 0, "H"),
        "hv": f.sat_p(pa6, 1, "H"),
        "hgas": f.h(pa6, -30 + K0),
        "hliq": f.liquid_h(pa6, Tin + K0),
    }
    cases_def = [
        ("Výchozí", P6, -30.0, Tin, True),
        ("Nasycená", P6, -30.0, None, True),
        ("T_out −25", P6, -25.0, Tin, False),
        ("T_out −20", P6, -20.0, Tin, False),
        ("5 bar a, nasycená", 5.0, -30.0, None, False),
        ("15 barg, T_out −20", 16.01325, -20.0, Tin, False),
        ("30 bar a, nasycená", 30.0, -30.0, None, True),
        ("30 bar a, " + f"{Tin:.0f} °C".replace("-", "−"), 30.0, -30.0, Tin, False),
        ("40 bar a, " + f"{Tin40:.1f} °C".replace("-", "−").replace(".", ","), 40.0, -30.0, Tin40, False),
        ("40 bar a, " + f"{Tin:.0f} °C".replace("-", "−"), 40.0, -30.0, Tin, False),
        ("Mimo mřížku 20,5 bar a / −57,5 °C / −150,5 °C", 20.5, -57.5, -150.5, False),
    ]
    cases = []
    for name, p, Tout, Ti, zones in cases_def:
        _, Q, QI, QII, _ = _duty(f, 1000.0, p, Tout, Ti)
        c = {"name": name, "p": p, "Tout": Tout, "Tin": Ti, "Q": round(Q, 3)}
        if zones:
            c["QI"], c["QII"] = round(QI, 3), round(QII, 3)
        cases.append(c)
    b = CHART_BASIS
    ua1 = _ua(f, 1.0, b["p_bar_a"], b["T_amb_C"], b["T_amb_C"] - b["approach_K"], None)
    neq = [
        {"Ta": Ta, "Tout": To, "N": round(_ua(f, 1000.0, P6, Ta, To, Tin) / ua1, 1)}
        for Ta, To in ((0.0, -30.0), (-15.0, -30.0), (-15.0, -25.0), (-15.0, -20.0))
    ]
    m = _duty(f, 1000.0, P6, -30.0, Tin)[0]
    reheat = [{"to": to, "Q": round(m * (f.h(pa6, to + K0) - f.h(pa6, -40 + K0)), 3)} for to in (-30.0, -20.0)]
    r3 = lambda x: round(x, 3)
    return {
        "fluid": key,
        "coolprop_version": COOLPROP_VERSION,
        "note": "Vygenerováno přímo z CoolProp (ne z tabulek); h = 0 pro nasycenou kapalinu při 1,01325 bar; V̇n = 1000 Nm³/h.",
        "T_in_default_C": Tin,
        "props": {k: (round(v, 6) if k == "rho_n" else r3(v)) for k, v in props.items()},
        "cases": cases,
        "ua1_chart": round(ua1, 4),
        "neq": neq,
        "reheat": reheat,
    }


def dump(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"


def same_data(a, b, path: str = "") -> str | None:
    """Číselné porovnání s tolerancí (poslední číslice se mohou lišit podle platformy)."""
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return f"{path}: jiné klíče"
        for k in a:
            r = same_data(a[k], b[k], f"{path}.{k}")
            if r:
                return r
        return None
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return f"{path}: jiná délka"
        for i, (x, y) in enumerate(zip(a, b)):
            r = same_data(x, y, f"{path}[{i}]")
            if r:
                return r
        return None
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        if abs(a - b) <= 2e-6 + 1e-8 * abs(b):
            return None
        return f"{path}: {a} ≠ {b}"
    return None if a == b else f"{path}: {a!r} ≠ {b!r}"


def main() -> None:
    check = "--check" in sys.argv
    OUT_DATA.mkdir(parents=True, exist_ok=True)
    OUT_FIX.mkdir(parents=True, exist_ok=True)
    ok = True
    for key in FLUIDS:
        outputs = {
            OUT_DATA / f"{key}.json": dump(build_tables(key)),
            OUT_FIX / f"coolprop-validation-{key}.json": dump(build_validation(key)),
        }
        if key in REFERENCE_FLUIDS:
            (ROOT / "src" / "data" / "reference").mkdir(parents=True, exist_ok=True)
            outputs[ROOT / "src" / "data" / "reference" / f"{key}.json"] = json.dumps(
                build_reference(key), ensure_ascii=False, indent=1
            ) + "\n"
        for path, text in outputs.items():
            if check:
                diff = (
                    same_data(json.loads(text), json.loads(path.read_text(encoding="utf-8")))
                    if path.exists()
                    else "soubor chybí"
                )
                same = diff is None
                print(f"{'OK ' if same else 'ROZDÍL'} {path.relative_to(ROOT)}{'' if same else ' – ' + diff}")
                ok &= same
            else:
                path.write_text(text, encoding="utf-8")
                print(f"zapsáno {path.relative_to(ROOT)} ({len(text) // 1024} kB)")
    if not ok:
        sys.exit("Vygenerovaná data neodpovídají uloženým souborům.")


if __name__ == "__main__":
    main()
