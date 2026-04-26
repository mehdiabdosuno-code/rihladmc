/**
 * YS Travel Morocco Proposal — S'TOURS DMC
 *
 * Structure:
 *   Section 1 (no header/footer) — Page de garde ORIGINALE (image pleine page)
 *   Section 2 (no header/footer) — Page de garde ÉDITABLE pour le travel designer
 *   Section 3 (header + footer)  — Contenu (Accommodation, Catering, Activities,
 *                                             Itinerary, Guides, Transport, Pricing,
 *                                             Inclusions, Exclusions, Contact)
 *
 * Logos corrects:
 *   - stours_dmc_logo.png  → vrai logo S'TOURS DMC (bleu + rouge) dans header
 *   - stours_footer.png    → footer original 3 colonnes
 *   - cover_full.png       → page de garde originale pleine page
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber,
  ImageRun, PageBreak, SectionType, HeightRule,
} = require('docx');

// ─── Brand colours (from real S'TOURS doc) ────────────────────
const RED       = 'A8371D';   // rufous / deep red
const NAVY      = '1628A9';   // S'TOURS blue
const INK       = '1A1A1A';
const GREY      = '6B6B6B';
const LINE      = 'DDDDDD';
const CREAM     = 'FFFCF5';
const HIGHLIGHT = 'FEE8E1';   // pricing selected row

// ─── Load brand assets ─────────────────────────────────────────
const DIR    = path.join(__dirname, '../../docs');
const cover  = fs.readFileSync(`${DIR}/stours_cover_template.png`); // original cover
const logo   = fs.readFileSync(`${DIR}/stours_dmc_logo.png`);      // real DMC logo
const footer = fs.readFileSync(`${DIR}/stours_footer.png`);        // 3-col footer
const bus    = fs.readFileSync(`${DIR}/stours_bus.jpg`);

// ─── A4 page metrics (DXA) ─────────────────────────────────────
const PW   = 11906;   // A4 width
const PH   = 16838;   // A4 height
const ML   = 1000;    const MR = 1000;
const MT   = 900;     const MB = 1300;
const CW   = PW - ML - MR;   // 9906 DXA content width

// ─── Helpers ───────────────────────────────────────────────────
const bdr  = (c = LINE, s = 4) => ({ style: BorderStyle.SINGLE, size: s, color: c });
const BDRS = { top: bdr(), bottom: bdr(), left: bdr(), right: bdr() };
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NONE_BDRS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

const txt = (text, o = {}) => new TextRun({
  text: String(text),
  font:    o.font    ?? 'Calibri',
  size:    o.size    ?? 20,
  bold:    o.bold    ?? false,
  italics: o.italics ?? false,
  color:   o.color   ?? INK,
  break:   o.break,
});

const run = (children, o = {}) => new TextRun({ children, font: 'Calibri', size: o.size ?? 18, color: o.color ?? INK });

const par = (content, o = {}) => new Paragraph({
  alignment:     o.align ?? AlignmentType.LEFT,
  spacing:       { before: o.before ?? 0, after: o.after ?? 60 },
  numbering:     o.numbering,
  shading:       o.fill ? { type: ShadingType.CLEAR, fill: o.fill } : undefined,
  border:        o.border,
  children:      Array.isArray(content) ? content : [txt(content, o)],
});

// Banner for section headers (red bar, white text)
const banner = (title) => new Paragraph({
  spacing: { before: 180, after: 100 },
  shading: { type: ShadingType.CLEAR, fill: RED },
  children: [new TextRun({
    text: '  ' + title.toUpperCase(),
    bold: true, font: 'Calibri', size: 22, color: 'FFFFFF',
  })],
});

// Table cell
const cell = (content, o = {}) => new TableCell({
  borders:      o.noBorder ? NONE_BDRS : BDRS,
  width:        o.w ? { size: o.w, type: WidthType.DXA } : undefined,
  shading:      o.fill ? { type: ShadingType.CLEAR, fill: o.fill } : undefined,
  verticalAlign: VerticalAlign.CENTER,
  margins:      { top: 80, bottom: 80, left: 100, right: 100 },
  children: [new Paragraph({
    alignment: o.align ?? AlignmentType.LEFT,
    spacing:   { before: 0, after: 0 },
    children:  Array.isArray(content)
      ? content
      : [txt(content, { bold: o.bold, color: o.color ?? INK, size: o.size ?? 18, italics: o.italics })],
  })],
});

const hCell = (text, o = {}) =>
  cell(text, { ...o, fill: RED, color: 'FFFFFF', bold: true, align: AlignmentType.CENTER });

// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════
const itinerary = JSON.parse(fs.readFileSync(path.join(__dirname, 'sample_project.json'))).itinerary;

const accomRows = [
  [1,'CASABLANCA', 'MOVENPICK CASABLANCA',      '5*','STANDARD','BB'],
  [2,'CHEFCHAOUEN','DAR ECHAOUEN',              '4*','STANDARD','HB'],
  [3,'FES',        'PALAIS MEDINA RIAD RESORT', '5*','STANDARD','HB'],
  [4,'MIDELT',     'TADART',                    '3*','STANDARD','HB'],
  [5,'MERZOUGA',   'KASBAH TOMBOUCTOU',         '4*','STANDARD','HB'],
  [6,'OUARZAZATE', 'OSCAR STUDIO HOTEL',        '4*','STANDARD','HB'],
  [7,'MARRAKECH',  'ADAM PARK',                 '5*','STANDARD','HB'],
  [8,'MARRAKECH',  'ADAM PARK',                 '5*','STANDARD','BB'],
];

const cateringRows = [
  [1,'CASABLANCA',  'DINNER',"RICK'S CAFÉ",         'Signature dining experience'],
  [2,'RABAT',       'LUNCH', 'MARINA SLA',           'Fish soup or salad · Fresh fish plate & garnish · Dessert'],
  [2,'CHEFCHAOUEN', 'DINNER','HOTEL',                'Buffet or 3-course menu'],
  [3,'VOLUBILIS',   'LUNCH', 'ROMAN CITY',           'Harira soup or Moroccan salads · Beef tajine with vegetables · Seasonal fruit / Moroccan cake'],
  [3,'FES',         'DINNER','HOTEL',                'Buffet or 3-course menu'],
  [4,'FES',         'LUNCH', 'CHINESE RESTAURANT',   '7 dishes + 1 soup'],
  [4,'MIDELT',      'DINNER','HOTEL',                'Soup or salad · Grilled trout with garnish · Apple tart'],
  [5,'ERFOUD',      'LUNCH', 'CHERGUI HOTEL',        'Salad · Lamb with prunes · Seasonal fruits'],
  [5,'MERZOUGA',    'DINNER','HOTEL',                'Buffet or 3-course menu'],
  [7,'TINGHIR',     'LUNCH', 'YASMINA',              'Mixed salad or vegetable soup · Chicken tajine with lemon & olives · Assorted fruits'],
  [7,'OUARZAZATE',  'DINNER','HOTEL',                'Buffet or 3-course menu'],
  [8,'AIT BENHADDOU','LUNCH',"OASIS D'OR",           'Mixed salad or Berber omelette · Mixed skewers with garnish · Dessert'],
  [8,'MARRAKECH',   'DINNER','HOTEL',                'Buffet or 3-course menu'],
  [9,'ESSAOUIRA',   'LUNCH', 'ZAHRA GRILL',          'Octopus salad · Oysters · Grilled fish with garnish · Dessert'],
  [9,'MARRAKECH',   'DINNER','CHEZ ALI (Fantasia show)','Harira soup · Meat skewers · Vegetable couscous · Pastilla au lait · Mint tea · Moroccan pastries'],
];

const actRows = [
  [1,'CASABLANCA',   '—',                                                          'Royal Palace (exterior) · Habbous quarter · Mohammed V Square'],
  [2,'CASABLANCA',   'Hassan II Mosque — guided interior visit',                   '—'],
  [2,'RABAT',        '—',                                                          'Royal Palace of Rabat (exterior) · Hassan Tower · Mohammed V Mausoleum & Royal Cavalry'],
  [3,'CHEFCHAOUEN',  '—',                                                          'Blue Medina of Chefchaouen'],
  [3,'VOLUBILIS',    'Volubilis UNESCO Roman site (entrance)',                     '—'],
  [3,'MEKNES',       '—',                                                          'Bab Mansour Gate · City Walls (photo stop)'],
  [4,'FES',          'Tannerie terraces (free) · Bou Inania Madrasah (entrance)',  'Bab Bou Jeloud · Karaouine Mosque · Moulay Idriss Mosque · Royal Palace'],
  [5,'IFRANE',       '—',                                                          'Stone Lion'],
  [5,'MERZOUGA',     '4x4 transfer + Sunset camel ride over Erg Chebbi',          'Fossil factory'],
  [6,'TINGHIR',      '—',                                                          'Kasbah Road · Qanat · Tinghir Oasis · Todgha Gorges · Dades Valley / Kelaa M\u2019Gouna'],
  [7,'OUARZAZATE',   'Atlas Studios (entrance)',                                   'A\u00EFt Ben Haddou (UNESCO) · Tizi-N-Tichka'],
  [7,'MARRAKECH',    '—',                                                          'Koutoubia Mosque (exterior)'],
  [8,'ESSAOUIRA',    '—',                                                          'Argan Oil Cooperative · Essaouira medina · Harbor · Fortress · Fish Market'],
  [9,'MARRAKECH',    'Bahia Palace (entrance) · Horse carriage in medina (4 pax/carriage) · Majorelle Garden (entrance)', '—'],
];

// ─── Tables ────────────────────────────────────────────────────
const mkTable = (colWidths, headerCells, dataRows, zebraFill = 'FFFDF3') =>
  new Table({
    width:        { size: CW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ tableHeader: true, children: headerCells }),
      ...dataRows.map((row, idx) =>
        new TableRow({
          children: row.map((c, ci) =>
            c.isCell ? c : cell(c.text ?? String(c), {
              w:      colWidths[ci],
              fill:   idx % 2 ? zebraFill : 'FFFFFF',
              bold:   c.bold,
              color:  c.color,
              size:   c.size ?? 17,
              align:  c.align ?? AlignmentType.LEFT,
              italics:c.italics,
            })
          ),
        })
      ),
    ],
  });

// Accommodation
const accomW = [700, 1600, 2800, 900, 1200, 710];
const accomTable = mkTable(
  accomW,
  ['DAY','CITY','HOTEL / RIAD','CATEGORY','ROOM TYPE','BASIS'].map((h,i) => hCell(h,{w:accomW[i]})),
  accomRows.map(([d,c,h,cat,r,b]) => [
    { text:d,   bold:true, align:AlignmentType.CENTER },
    { text:c,   bold:true, align:AlignmentType.CENTER },
    { text:h,   bold:true },
    { text:cat, bold:true, align:AlignmentType.CENTER, color:RED },
    { text:r,   align:AlignmentType.CENTER },
    { text:b,   bold:true, align:AlignmentType.CENTER },
  ])
);

// Catering
const catW = [600, 1400, 1000, 1900, 4010];
const cateringTable = mkTable(
  catW,
  ['DAY','CITY','MEAL','RESTAURANT','MENU'].map((h,i) => hCell(h,{w:catW[i]})),
  cateringRows.map(([d,c,m,r,mn]) => [
    { text:d,  bold:true, align:AlignmentType.CENTER },
    { text:c,  bold:true },
    { text:m,  bold:true, align:AlignmentType.CENTER, color:RED },
    { text:r,  bold:true },
    { text:mn, size:16 },
  ])
);

// Activities
const actW = [600, 1600, 3400, 3310];
const activitiesTable = mkTable(
  actW,
  ['DAY','CITY','ENTRANCE FEE INCL.','VIEW FROM OUTSIDE'].map((h,i) => hCell(h,{w:actW[i]})),
  actRows.map(([d,c,e,v]) => [
    { text:d, bold:true, align:AlignmentType.CENTER },
    { text:c, bold:true },
    { text:e, size:16, bold: e !== '—' },
    { text:v, size:16, italics:true, color:GREY },
  ])
);

// Pricing
const priceW = [2800, 4300, 1900];
const pricingTable = new Table({
  width: { size: CW, type: WidthType.DXA },
  columnWidths: priceW,
  rows: [
    new TableRow({ tableHeader: true, children: [
      hCell('BASIS',                                     {w:priceW[0]}),
      hCell('PRICE / PERSON SHARING TWIN ROOM — USD',   {w:priceW[1]}),
      hCell('SINGLE SUPPLEMENT — USD',                  {w:priceW[2]}),
    ]}),
    ...[ ['10 + 1 FOC','1,588 $','315 $',false],
         ['15 + 1 FOC','1,385 $','315 $',false],
         ['20 + 1 FOC','1,275 $','315 $',true ],   // highlighted
         ['25 + 1 FOC','1,210 $','315 $',false],
         ['30 + 1 FOC','1,165 $','315 $',false],
         ['35 + 1 FOC','1,140 $','315 $',false],
    ].map(([b,p,s,sel]) => new TableRow({ children: [
      cell(b, { w:priceW[0], bold:true,  align:AlignmentType.CENTER, fill:sel?HIGHLIGHT:'FFFFFF' }),
      cell(p, { w:priceW[1], bold:true,  align:AlignmentType.CENTER, size:sel?28:22, color:sel?RED:INK, fill:sel?HIGHLIGHT:'FFFFFF' }),
      cell(s, { w:priceW[2], bold:true,  align:AlignmentType.CENTER, fill:sel?HIGHLIGHT:'FFFFFF' }),
    ]})),
  ],
});

// ─── Header & Footer (shared by content section) ──────────────
// Logo: 3508×2481 → scale to 150px wide keeping ratio
const LOGO_W  = 150;
const LOGO_H  = Math.round(LOGO_W * (2481/3508));  // ~107
// Footer: 1992×284 → full content width
const FOOT_W  = Math.round(CW * 0.045);  // DXA to pixel approx
const FOOT_PX = 520;
const FOOT_HX = Math.round(FOOT_PX * (284/1992));

const contentHeader = new Header({ children: [
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing:   { after: 60 },
    children:  [new ImageRun({ data: logo, type: 'png',
                               transformation: { width: LOGO_W, height: LOGO_H } })],
  }),
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: RED, space: 1 } },
    children: [txt('')],
  }),
]});

const contentFooter = new Footer({ children: [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing:   { before: 60, after: 40 },
    children:  [new ImageRun({ data: footer, type: 'png',
                               transformation: { width: FOOT_PX, height: FOOT_HX } })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing:   { before: 0, after: 20 },
    children: [
      txt('YS Travel Morocco 9D/8N — November 2026   ·   Page ', { size: 14, color: GREY }),
      new TextRun({ children: [PageNumber.CURRENT], size: 14, color: GREY, font: 'Calibri' }),
      txt(' / ', { size: 14, color: GREY }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: GREY, font: 'Calibri' }),
    ],
  }),
]});

// ─── Bullet list items ─────────────────────────────────────────
const bullet = (text) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 },
  spacing:   { after: 30 },
  children:  [txt(text, { size: 18 })],
});

// ─── DAY blocks ────────────────────────────────────────────────
const dayBlocks = itinerary.flatMap(d => [
  new Paragraph({
    spacing: { before: 180, after: 80 },
    border:  { left: { style: BorderStyle.SINGLE, size: 20, color: RED, space: 8 } },
    shading: { type: ShadingType.CLEAR, fill: 'FFFDF3' },
    children: [
      txt(`DAY ${d.day}`, { bold: true, color: RED, size: 22 }),
      txt('  \u2014  ',   { color: GREY, size: 22 }),
      txt(d.title.toUpperCase(), { bold: true, size: 22 }),
    ],
  }),
  par([
    txt('Overnight: ',                             { bold: true, size: 18, color: GREY }),
    txt(`${d.hotel} (${d.category})`,              { size: 18, bold: true }),
    txt('   ·   ',                                 { size: 18, color: GREY }),
    txt('Meals: ',                                 { bold: true, size: 18, color: GREY }),
    txt(d.meal_plan,                               { size: 18, bold: true, color: RED }),
  ], { after: 60 }),
  par(d.description, { size: 18, after: 60, color: INK }),
  par([txt('Highlights:', { bold: true, size: 18, color: RED })], { after: 30 }),
  ...d.activities.map(a => new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing:   { after: 24 },
    children:  [txt(a, { size: 17 })],
  })),
  par('', { after: 40 }),
]);

// ═══════════════════════════════════════════════════════════════
// BUILD DOCUMENT  — 3 sections
// ═══════════════════════════════════════════════════════════════
const noMarginPage = {
  size:   { width: PW, height: PH },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
};
const contentPage = {
  size:   { width: PW, height: PH },
  margin: { top: MT, right: MR, bottom: MB, left: ML },
};

const doc = new Document({
  creator:     "S'TOURS DMC Morocco",
  title:       'YS Travel Morocco 9D/8N — Discover Morocco',
  description: 'Premium group tour proposal — November 2026',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 20 } } },
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u25AA',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
    }],
  },

  sections: [

    // ─────────────────────────────────────────────────────────
    // SECTION 1 — Original cover page (full-bleed image, locked)
    // The travel designer should NOT touch this page — it is the
    // S'TOURS official cover. To use a custom photo, edit Section 2.
    // ─────────────────────────────────────────────────────────
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: noMarginPage,
      },
      headers: { default: new Header({ children: [par('')] }) },
      footers: { default: new Footer({ children: [par('')] }) },
      children: [
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [new ImageRun({
            data: cover,
            type: 'png',
            // A4 at 96 dpi ≈ 794×1123 px; fill the page
            transformation: { width: 794, height: 1123 },
          })],
        }),
      ],
    },

    // ─────────────────────────────────────────────────────────
    // SECTION 2 — Editable cover page for travel designer
    // Replace the title, subtitle, date and client name here.
    // Export as DOCX when done.
    // ─────────────────────────────────────────────────────────
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PW, height: PH },
                margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } },
      },
      headers: { default: new Header({ children: [par('')] }) },
      footers: { default: new Footer({ children: [par('')] }) },
      children: [
        // Logo centré
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { before: 600, after: 200 },
          children:  [new ImageRun({ data: logo, type: 'png',
                                     transformation: { width: 220, height: Math.round(220*(2481/3508)) } })],
        }),

        // Ligne rouge
        new Paragraph({
          border:  { bottom: { style: BorderStyle.SINGLE, size: 24, color: RED, space: 6 } },
          spacing: { before: 0, after: 400 },
          children:[txt('')],
        }),

        // ▼▼▼ TRAVEL DESIGNER — modifiez les champs ci-dessous ▼▼▼
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { after: 80 },
          children:  [new TextRun({
            text: 'DISCOVER MOROCCO',
            font: 'Calibri', size: 56, bold: true, color: RED,
          })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { after: 60 },
          children:  [new TextRun({
            text: '09 DAYS / 08 NIGHTS',
            font: 'Calibri', size: 32, bold: true, color: INK,
          })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { after: 400 },
          children:  [new TextRun({
            text: 'November 2026  ·  Custom program for SAINT TOUR',
            font: 'Calibri', size: 22, italics: true, color: GREY,
          })],
        }),
        // Route
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { after: 80 },
          children:  [new TextRun({
            text: 'Casablanca  ›  Chefchaouen  ›  Fès  ›  Merzouga  ›  Ouarzazate  ›  Marrakech',
            font: 'Calibri', size: 20, color: NAVY, bold: true,
          })],
        }),
        // ▲▲▲ FIN DES CHAMPS MODIFIABLES ▲▲▲

        // Ligne rouge bas
        new Paragraph({
          border:  { top: { style: BorderStyle.SINGLE, size: 24, color: RED, space: 6 } },
          spacing: { before: 600, after: 200 },
          children:[txt('')],
        }),

        // Note pour le designer
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: '[ Travel Designer: modify title, subtitle, dates and route above — then delete this note ]',
            font: 'Calibri', size: 14, italics: true, color: 'BBBBBB',
          })],
        }),
      ],
    },

    // ─────────────────────────────────────────────────────────
    // SECTION 3 — Content (with S'TOURS header/footer on every page)
    // ─────────────────────────────────────────────────────────
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: contentPage,
      },
      headers: { default: contentHeader },
      footers: { default: contentFooter },
      children: [

        // ── General Information ──────────────────────────────
        banner('General Information'),
        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [2600, 7310],
          rows: [
            ['CLIENT',           'SAINT TOUR'],
            ['CLIENT REFERENCE', 'YS Travel Morocco 11D adhoc — November 2026 departure'],
            ['TRAVEL DATES',     'November 2026'],
            ['GROUP SIZE',       '20 PAX  +  1 FOC (tour leader)'],
            ['DURATION',         '9 days / 8 nights'],
            ['GUIDE LANGUAGE',   'English-speaking guide throughout the journey'],
          ].map(([k, v], idx) => new TableRow({ children: [
            cell(k, { w:2600, fill:'FFFDF3', bold:true, color:GREY }),
            cell(v, { w:7310, fill: idx === 2 || idx === 3 ? 'FFF8F0' : 'FFFFFF',
                      bold: idx < 4 }),
          ]})),
        }),
        par(''),

        // ── Accommodation ─────────────────────────────────────
        banner('Accommodation'),
        accomTable,
        par('N.B.: Services are subject to availability upon confirmation; hotels may be substituted with similar ones.',
            { italics:true, color:GREY, size:15, before:80 }),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Catering ─────────────────────────────────────────
        banner('Catering'),
        cateringTable,
        par('N.B.: Mineral water included — 1 large bottle (1.5 L) per 3 pax per meal.',
            { italics:true, color:GREY, size:15, before:80 }),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Activities & Monuments ────────────────────────────
        banner('Activities & Monuments'),
        activitiesTable,
        par('\u2022 Most monuments in Meknes are under renovation and may be inaccessible.',
            { italics:true, color:GREY, size:15, before:80, after:20 }),
        par('\u2022 All museums in Morocco are closed on Tuesday and on religious holidays.',
            { italics:true, color:GREY, size:15, after:20 }),
        par('\u2022 Entrance fees for some monuments may be subject to change without prior notice.',
            { italics:true, color:GREY, size:15, after:60 }),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Itinerary ─────────────────────────────────────────
        banner('Itinerary — Day by Day'),
        ...dayBlocks,

        new Paragraph({ children: [new PageBreak()] }),

        // ── Guides ───────────────────────────────────────────
        banner('Guides'),
        par([
          txt('An ', { size: 18 }),
          txt('ENGLISH-SPEAKING ', { bold: true, size: 18, color: RED }),
          txt('guide will be available throughout the journey — facilitating travel, providing insights into visited sites, and assisting with any inquiries.', { size: 18 }),
        ], { after: 80 }),
        par('For groups of 20 participants or more, the inclusion of a licensed local guide in each city is mandatory under Moroccan law. These experts provide detailed knowledge of their respective cities.',
            { size: 18, after: 100 }),

        // ── Transportation ────────────────────────────────────
        banner('Transportation'),
        par("At S\u2019TOURS, we prioritize the comfort and safety of our guests. All our vehicles are recent models, equipped with seatbelts, A/C, reclining seats, and Wi-Fi. Signal coverage in Morocco can be uneven and may be limited in certain areas.",
            { size: 18, after: 60 }),
        par('Our drivers are seasoned professionals with years of experience ensuring smooth and safe journeys.',
            { size: 18, after: 60 }),
        par('While we always strive to use our own fleet, in instances of high demand, we rely on trusted partners who meet the same standards of quality and safety.',
            { size: 18, after: 100 }),

        new Paragraph({
          spacing: { after: 40 },
          children: [
            txt('VEHICLE: ', { bold: true, color: RED, size: 20 }),
            txt('48-SEATER COACH', { bold: true, size: 20 }),
          ],
        }),
        par('MAN Irizar i6 / Mercedes Irizar i6 or similar — for groups from 26 to 40 people.',
            { italics: true, size: 16, color: GREY, after: 80 }),

        // Bus photo
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { before: 60, after: 80 },
          children:  [new ImageRun({ data: bus, type: 'jpg',
                                     transformation: { width: 340, height: Math.round(340*(326/492)) } })],
        }),

        par('\u2022 Images are for reference only. A similar vehicle may be used if unavailable.',
            { italics:true, size:14, color:GREY, after:20 }),
        par('\u2022 Vehicles are not equipped with onboard restrooms. Comfort breaks are scheduled during the journey.',
            { italics:true, size:14, color:GREY, after:100 }),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Pricing ───────────────────────────────────────────
        banner('Pricing — Estimate Offer · November 2026'),
        pricingTable,
        new Paragraph({
          spacing: { before: 80, after: 100 },
          children: [new TextRun({
            text: '\u2605  Recommended scenario (highlighted): 20 + 1 FOC basis — USD 1,275 / person',
            font: 'Calibri', size: 17, bold: true, italics: true, color: RED,
          })],
        }),

        // ── Inclusions ────────────────────────────────────────
        banner('Inclusions'),
        ...[
          '09 days / 08 nights accommodation in hotels listed (or similar)',
          '08 buffet breakfasts at hotels',
          '07 lunches and 08 dinners at venues specified in the Catering section',
          'Mineral water: 1 bottle (1.5 L) per 3 pax per meal',
          'Complimentary single room for the Tour Leader (1 FOC)',
          '48-seater coach with A/C, reclining seats, seatbelts and Wi-Fi',
          'English-speaking guide throughout the tour',
          'Local licensed guides in each major city (mandatory for groups of 20+)',
          'All monument entrance fees as indicated with (\u2713) in Activities section',
          '4x4 Jeep excursion Erfoud \u2013 Merzouga (4 pax / vehicle)',
          'Sunset camel ride over the Erg Chebbi dunes',
          'Horse carriage tour in Marrakech (4 pax / carriage)',
          'Gala dinner with Fantasia show at Chez Ali — Marrakech',
          'Tips for restaurants and hotels (compulsory)',
          'Tips for hotel porters (in / out)',
          'City taxes',
          'Mineral water in coach: 1 bottle per pax per day',
        ].map(bullet),

        // ── Exclusions ────────────────────────────────────────
        banner('Exclusions'),
        ...[
          'International flights',
          'Visa fees (if applicable)',
          'Travel insurance',
          'Personal extras: laundry, telephone, minibar',
          'Tips for guides and drivers (recommended: USD 3\u20135 per pax per day)',
          'Any services not explicitly listed as included',
        ].map(bullet),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Contact ──────────────────────────────────────────
        banner("Contact — S'Tours DMC Morocco"),
        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [CW/2, CW/2],
          rows: [new TableRow({ children: [
            cell([
              txt("S\u2019TOURS DMC MOROCCO\n",     { bold:true, color:RED, size:24 }),
              txt('Your Premium Moroccan Partner\n\n',{ italics:true, color:GREY, size:16 }),
              txt('Casablanca H.Q\n',                { bold:true, size:17 }),
              txt('4, rue Turgot \u2013 Quartier Racine, 20100\n', { size:16 }),
              txt('T\u00E9l.: (+212) 522 95 40 00\n',{ size:16 }),
              txt('Email: contact@stours.ma\n\n',    { size:16, color:NAVY }),
              txt('Marrakech Office\n',              { bold:true, size:17 }),
              txt('61, rue Yougoslavie \u2013 Immeuble F \u2013 Gu\u00E9liz\n', { size:16 }),
              txt('T\u00E9l.: (+212) 524 43 67 46\n',{ size:16 }),
              txt('Email: contact@stours.ma',        { size:16, color:NAVY }),
            ], { w: CW/2, fill:'FFFDF3' }),
            cell([
              txt('Company Details\n',              { bold:true, color:RED, size:17 }),
              txt("S\u2019TOURS VOYAGES S.A.R.L\n", { size:16 }),
              txt('Capital: 2\u00A0000\u00A0000 MAD\n', { size:16 }),
              txt('R.C.: 44367\n',                  { size:16 }),
              txt('I.F.: 01000972\n',               { size:16 }),
              txt('ICE: 001542976000081\n',          { size:16 }),
              txt('Patente: 357 10095\n',            { size:16 }),
              txt('CNSS: 1 125899\n\n',             { size:16 }),
              txt('Website: www.stours.ma',          { size:16, color:NAVY, bold:true }),
            ], { w: CW/2 }),
          ]})],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { before: 300, after: 100 },
          children:  [new TextRun({
            text: "Thank you for considering S\u2019TOURS for your Moroccan journey.",
            font: 'Calibri', size: 20, bold: true, italics: true, color: RED,
          })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children:  [new TextRun({
            text: 'We look forward to crafting an unforgettable experience for your group.',
            font: 'Calibri', size: 18, italics: true, color: GREY,
          })],
        }),
      ],
    },
  ],
});

// ─── Write output ─────────────────────────────────────────────
Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, 'YS_Travel_Morocco_Final.docx');
  fs.writeFileSync(out, buf);
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`✓ DOCX: ${out}  (${kb} KB)`);
});
