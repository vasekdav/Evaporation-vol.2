# Changelog

Verze se zobrazuje v reportu (fáze 4).

## 0.1.0 – fáze 1: výpočetní jádro

- Generátor tabulek z CoolProp 7.2.0 pro O₂ a N₂, včetně validačních bodů.
- `PropertyProvider` nad tabulkami: nasycení, plyn, stlačená kapalina; bez tiché extrapolace.
- Výkon, rozklad q₁/q₂/q₃, zóny I/II, střední c_p, spotřeba, dohřev.
- Ideální dolní mez velikosti (UA, N_eq, tepelná náročnost, nejmenší kapacita větve) s povinnými upozorněními.
- Psychrometrie (Magnus nad vodou / ledem).
- Kontroly K1–K8 a stav výsledku.
- Katalogové základy (Chart SuperGap EU, Tekoma/Cryonorm) a modely Chart SuperGap EU – ilustrativní, editovatelné.
- Testy: referenční případy kap. 9 pro O₂ i N₂, přesnost tabulek v 3000 bodech na látku, větve kontrol.
- CI: typová kontrola, testy a ověření, že tabulky odpovídají CoolProp 7.2.0.
