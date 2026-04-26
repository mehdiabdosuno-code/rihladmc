/**
 * Source: 20260408 YS Travel Morocco 11D adhoc (Giant Tour is competitor) November 2026 dep.xls
 * Extraction fidèle des 3 zones du fichier Excel de cotation concurrent.
 */

// ── ZONE 1 : Détail Jour / Jour ────────────────────────────────────────
// Colonnes : DAY | KMS | CITIES | HOTEL | FORMULE | 1/2DBL | SS | TAXES | WATER | RESTAURANT | PRIX | MONUMENT | MONU | LG
export const XLS_DAILY = [
  { day:1,  date:'01/11/2026', km:0,   cities:'CASABLANCA',            hotel:'MÖVENPICK',      formula:'BB', halfDbl:600, ss:400,  taxe:39.6, water:40, rest:"Rick's Café",    restPrice:500, monument:'—',                monuPrice:0,   lg:0   },
  { day:2,  date:'02/11/2026', km:371, cities:'CASA › RBA › CHEFCHAOUEN', hotel:"D'ECHAOUEN",  formula:'HB', halfDbl:746, ss:350,  taxe:0,    water:40, rest:"M'Sla Riad",    restPrice:160, monument:'Oud / Mosquée',   monuPrice:150, lg:115 },
  { day:3,  date:'03/11/2026', km:200, cities:'CHEFCHAOUEN › FÈS',      hotel:'PALAIS MEDINA', formula:'HB', halfDbl:750, ss:400,  taxe:39.6, water:40, rest:'Roman City',     restPrice:140, monument:'VOL (visite)',     monuPrice:100, lg:100 },
  { day:4,  date:'04/11/2026', km:280, cities:'FÈS › MIDELT',           hotel:'TADDART',        formula:'HB', halfDbl:420, ss:170,  taxe:10,   water:40, rest:'Chez Nour',      restPrice:150, monument:'Médersa Bou Inania', monuPrice:20, lg:100 },
  { day:5,  date:'05/11/2026', km:370, cities:'MIDELT › MERZOUGA',      hotel:'K. TOMBOUCTOU', formula:'HB', halfDbl:550, ss:250,  taxe:5,    water:40, rest:'L. Rest.',        restPrice:150, monument:'—',               monuPrice:0,   lg:0   },
  { day:6,  date:'06/11/2026', km:350, cities:'MERZOUGA › OUARZAZATE',  hotel:'OSCAR',          formula:'HB', halfDbl:700, ss:350,  taxe:16.5, water:40, rest:'Yasmina',         restPrice:110, monument:'—',               monuPrice:0,   lg:0   },
  { day:7,  date:'07/11/2026', km:195, cities:'OUARZAZATE › MARRAKECH', hotel:'ADAM PARK',      formula:'HB', halfDbl:680, ss:350,  taxe:28.6, water:40, rest:'Oasis',           restPrice:140, monument:'Studio T.',        monuPrice:80,  lg:0   },
  { day:8,  date:'08/11/2026', km:100, cities:'RAK / ESS / RAK',        hotel:'ADAM PARK',      formula:'BB', halfDbl:570, ss:350,  taxe:28.6, water:40, rest:'Zahra + Chez Ali', restPrice:650, monument:'Palais Badi/Maje', monuPrice:270, lg:0   },
  { day:9,  date:'09/11/2026', km:0,   cities:'MARRAKECH — DÉPART',     hotel:'DÉPART',         formula:'—',  halfDbl:0,   ss:0,    taxe:0,    water:0,  rest:'—',               restPrice:0,   monument:'—',               monuPrice:0,   lg:0   },
];

// ── ZONE 2 : Consolidation des Coûts ──────────────────────────────────
// Coûts FIXES par personne (constants quelle que soit la taille du groupe)
export const XLS_FIXED = {
  hotels:      XLS_DAILY.reduce((s, d) => s + d.halfDbl, 0),   // 5 016 MAD
  restaurants: XLS_DAILY.reduce((s, d) => s + d.restPrice, 0), // 2 000 MAD
  monuments:   XLS_DAILY.reduce((s, d) => s + d.monuPrice, 0), // 620 MAD
  taxes:       XLS_DAILY.reduce((s, d) => s + d.taxe, 0),      // 167.9 MAD
  water:       XLS_DAILY.reduce((s, d) => s + d.water, 0),     // 320 MAD
  local_guides: XLS_DAILY.reduce((s, d) => s + d.lg, 0),       // 315 MAD (Fès, Chefchaouen, Midelt)
  extras:      40, // chameau + calèche Marrakech (ligne « Extras » du XLS)
};

// Coûts VARIABLES du groupe (divisés par nombre de PAX)
// ⚠ Les guides locaux sont maintenant dans XLS_FIXED (coût fixe/pax, pas variable)
export const XLS_VARIABLE = {
  bus:          31500, // MAD — autocar 48 places (8.5 MAD/km × 3 706 km A/R circuit)
  guide:         9000, // MAD — guide national × 9 jours (1 000 MAD/jour)
  taxi_chef:     1200, // MAD — taxis Chefchaouen (médina piétonne)
  merzouga_4x4:  3500, // MAD — 4x4 Merzouga / désert Sahara
  upgrade:        400, // MAD — upgrade véhicule
};

// Supplément Single total circuit
export const XLS_SINGLE_SUPPLEMENT = XLS_DAILY.reduce((s, d) => s + d.ss, 0); // 2 620 MAD

// Marge concurrente (Giant Tour / YS Travel)
export const XLS_MARGIN_PCT = 8;

// ── ZONE 3 : Grille Exacte de la Feuille Excel ───────────────────────
// Valeurs brutes extraites de la feuille de calcul (lignes 38-67)
export const XLS_GRID_REFERENCE: Record<number, { cost: number; sell: number }> = {
  10: { cost: 13233, sell: 14292 },
  15: { cost: 11535, sell: 12458 },
  20: { cost: 10614, sell: 11463 },
  25: { cost: 10077, sell: 10883 },
  30: { cost:  9719, sell: 10497 },
  35: { cost:  9494, sell: 10253 },
};

// Taux de change opérationnel
export const XLS_EXCHANGE_RATE = 10.1; // 1 USD = 10.1 MAD

// Métadonnées du circuit
export const XLS_META = {
  reference:    '20260408-YS-TRAVEL-MAR-11D',
  client:       'YS Travel',
  competitor:   'Giant Tour',
  destination:  'Maroc — Circuit Impérial + Sahara',
  duration:     '11 jours / 8 nuits',
  departure:    'Novembre 2026',
  km_total:     1866,
  bus_rate_km:  8.5,
};
