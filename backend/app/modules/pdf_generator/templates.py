"""HTML/CSS templates for PDF proposal generation.

Uses Jinja2 templates rendered to HTML, then converted to PDF via WeasyPrint.
The design mirrors S'TOURS branding: navy + gold accents, clean typography.
"""

PROPOSAL_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --navy: #1B2A4A;
  --gold: #C5943A;
  --light-gold: #F5E6CC;
  --bg: #FFFFFF;
  --text: #2D3748;
  --text-light: #718096;
  --border: #E2E8F0;
  --accent-bg: #F7FAFC;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

@page {
  size: A4;
  margin: 15mm 18mm 20mm 18mm;
  @bottom-center {
    content: "S'TOURS DMC Morocco — Proposition confidentielle";
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    color: #999;
  }
  @bottom-right {
    content: counter(page) " / " counter(pages);
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    color: #999;
  }
}

body {
  font-family: 'Inter', sans-serif;
  font-size: 10pt;
  line-height: 1.6;
  color: var(--text);
}

/* ── Cover page ──────────────────────────────────── */
.cover {
  page-break-after: always;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 250mm;
  text-align: center;
  background: linear-gradient(135deg, var(--navy) 0%, #2D4A7A 100%);
  color: white;
  padding: 40mm 30mm;
  margin: -15mm -18mm 0 -18mm;
}
.cover h1 {
  font-size: 28pt;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 8mm;
  line-height: 1.2;
}
.cover .subtitle {
  font-size: 14pt;
  font-weight: 300;
  color: var(--gold);
  margin-bottom: 15mm;
}
.cover .meta {
  font-size: 10pt;
  font-weight: 400;
  opacity: 0.85;
  line-height: 2;
}
.cover .logo-text {
  font-size: 18pt;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 3px;
  margin-bottom: 20mm;
  border-bottom: 2px solid var(--gold);
  padding-bottom: 3mm;
}
.cover .date {
  position: absolute;
  bottom: 25mm;
  font-size: 9pt;
  opacity: 0.7;
}

/* ── Section headers ─────────────────────────────── */
h2 {
  font-size: 16pt;
  font-weight: 700;
  color: var(--navy);
  border-bottom: 3px solid var(--gold);
  padding-bottom: 3mm;
  margin: 8mm 0 5mm 0;
}
h3 {
  font-size: 12pt;
  font-weight: 600;
  color: var(--navy);
  margin: 5mm 0 3mm 0;
}

/* ── Itinerary day cards ─────────────────────────── */
.day-card {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4mm 5mm;
  margin-bottom: 4mm;
  page-break-inside: avoid;
  background: var(--accent-bg);
}
.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2mm;
}
.day-number {
  background: var(--navy);
  color: var(--gold);
  font-weight: 700;
  font-size: 11pt;
  padding: 1mm 4mm;
  border-radius: 3px;
  min-width: 12mm;
  text-align: center;
}
.day-title {
  font-weight: 600;
  font-size: 11pt;
  color: var(--navy);
  flex: 1;
  margin-left: 3mm;
}
.day-city {
  font-size: 9pt;
  color: var(--gold);
  font-weight: 500;
}
.day-body {
  font-size: 9.5pt;
  color: var(--text);
  margin: 2mm 0;
}
.day-meta {
  display: flex;
  gap: 5mm;
  font-size: 8.5pt;
  color: var(--text-light);
  margin-top: 2mm;
}
.day-meta span {
  background: white;
  border: 1px solid var(--border);
  padding: 0.5mm 2mm;
  border-radius: 2px;
}
.activities-list {
  font-size: 9pt;
  color: var(--text);
  margin: 1mm 0 0 5mm;
}
.activities-list li { margin-bottom: 0.5mm; }

/* ── Pricing table ───────────────────────────────── */
.pricing-table {
  width: 100%;
  border-collapse: collapse;
  margin: 4mm 0;
  font-size: 9.5pt;
}
.pricing-table th {
  background: var(--navy);
  color: white;
  padding: 2.5mm 3mm;
  text-align: left;
  font-weight: 600;
}
.pricing-table th:last-child,
.pricing-table td:last-child {
  text-align: right;
}
.pricing-table td {
  padding: 2mm 3mm;
  border-bottom: 1px solid var(--border);
}
.pricing-table tr:nth-child(even) {
  background: var(--accent-bg);
}
.pricing-table .total-row {
  background: var(--light-gold) !important;
  font-weight: 700;
  font-size: 10.5pt;
}
.pricing-table .total-row td {
  border-top: 2px solid var(--gold);
  padding: 3mm;
}

/* ── Inclusions / Exclusions ─────────────────────── */
.two-columns {
  display: flex;
  gap: 5mm;
  margin: 3mm 0;
}
.two-columns > div {
  flex: 1;
  padding: 3mm;
  border-radius: 3px;
}
.inclusions {
  background: #F0FFF4;
  border: 1px solid #C6F6D5;
}
.exclusions {
  background: #FFF5F5;
  border: 1px solid #FED7D7;
}
.inclusions h3 { color: #276749; }
.exclusions h3 { color: #9B2C2C; }
.inc-list, .exc-list {
  font-size: 9pt;
  margin: 2mm 0 0 4mm;
}
.inc-list li { color: #2F855A; margin-bottom: 1mm; }
.exc-list li { color: #C53030; margin-bottom: 1mm; }

/* ── Terms & Conditions ──────────────────────────── */
.terms {
  font-size: 8.5pt;
  color: var(--text-light);
  line-height: 1.5;
  page-break-before: always;
}
.terms h3 {
  font-size: 10pt;
  color: var(--navy);
}
.terms ul { margin: 2mm 0 3mm 5mm; }
.terms li { margin-bottom: 1mm; }

/* ── Footer CTA ──────────────────────────────────── */
.cta-box {
  background: linear-gradient(135deg, var(--navy) 0%, #2D4A7A 100%);
  color: white;
  padding: 6mm;
  border-radius: 5px;
  text-align: center;
  margin-top: 8mm;
}
.cta-box h3 { color: var(--gold); margin-bottom: 2mm; }
.cta-box p { font-size: 9.5pt; opacity: 0.9; }
"""

PROPOSAL_HTML = """<!DOCTYPE html>
<html lang="{{ language }}">
<head>
  <meta charset="UTF-8">
  <style>{{ css }}</style>
</head>
<body>

<!-- ═══ COVER PAGE ═══ -->
<div class="cover">
  <div class="logo-text">S'TOURS</div>
  <h1>{{ project.name }}</h1>
  <div class="subtitle">{{ project.destination or "Maroc" }} — {{ project.duration_days or "?" }}J / {{ project.duration_nights or "?" }}N</div>
  <div class="meta">
    Préparé pour : <strong>{{ project.client_name or "Client" }}</strong><br>
    Dates : {{ project.travel_dates or "À confirmer" }}<br>
    Référence : {{ project.reference or "—" }}
  </div>
</div>

<!-- ═══ HIGHLIGHTS ═══ -->
{% if project.highlights %}
<h2>Points forts du voyage</h2>
<ul>
{% for h in project.highlights %}
  <li><strong>{{ h }}</strong></li>
{% endfor %}
</ul>
{% endif %}

<!-- ═══ ITINERARY ═══ -->
<h2>Programme jour par jour</h2>
{% for day in days %}
<div class="day-card">
  <div class="day-header">
    <span class="day-number">J{{ day.day_number }}</span>
    <span class="day-title">{{ day.title }}</span>
    <span class="day-city">{{ day.city or "" }}</span>
  </div>
  {% if day.subtitle %}<div style="font-size:9pt; color:#718096; margin-left:15mm;">{{ day.subtitle }}</div>{% endif %}
  <div class="day-body">{{ day.description or "" }}</div>
  {% if day.activities %}
  <ul class="activities-list">
    {% for a in day.activities %}<li>{{ a }}</li>{% endfor %}
  </ul>
  {% endif %}
  <div class="day-meta">
    {% if day.hotel %}<span>🏨 {{ day.hotel }}{% if day.hotel_category %} ({{ day.hotel_category }}){% endif %}</span>{% endif %}
    {% if day.meal_plan %}<span>🍽 {{ day.meal_plan }}</span>{% endif %}
    {% if day.travel_time %}<span>🚌 {{ day.travel_time }}</span>{% endif %}
    {% if day.distance_km %}<span>📍 {{ day.distance_km }} km</span>{% endif %}
  </div>
</div>
{% endfor %}

<!-- ═══ PRICING GRID ═══ -->
{% if pricing_ranges %}
<h2>Grille tarifaire</h2>
<p style="font-size:9pt; color:#718096; margin-bottom:3mm;">
  Prix par personne en base double — Marge {{ margin_pct }}% incluse — Devise {{ currency }}
</p>
<table class="pricing-table">
  <thead>
    <tr>
      <th>Modèle</th>
      <th>Pax (base)</th>
      <th>Coût/pax</th>
      <th>Prix vente/pax</th>
      <th>Total groupe</th>
    </tr>
  </thead>
  <tbody>
    {% for r in pricing_ranges %}
    <tr{% if loop.last %} class="total-row"{% endif %}>
      <td>{{ r.label }}</td>
      <td>{{ r.basis }}</td>
      <td>{{ "%.2f"|format(r.cost_per_person) }} {{ currency }}</td>
      <td><strong>{{ "%.2f"|format(r.selling_per_person) }} {{ currency }}</strong></td>
      <td>{{ "{:,.2f}".format(r.selling_total_group) }} {{ currency }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>

{% if pricing_ranges|length > 1 %}
<p style="font-size:9pt; color:#276749; margin-top:2mm;">
  ✦ Meilleur tarif : <strong>{{ best_price_label }}</strong> à {{ "%.2f"|format(best_price) }} {{ currency }}/personne
</p>
{% endif %}

<!-- Cost breakdown -->
{% if cost_breakdown %}
<h3>Décomposition des coûts (base {{ pricing_ranges[0].basis }} pax)</h3>
<table class="pricing-table">
  <thead>
    <tr><th>Catégorie</th><th>Coût/pax ({{ currency }})</th></tr>
  </thead>
  <tbody>
    {% for cat, val in cost_breakdown.items() %}
    <tr><td>{{ cat|capitalize }}</td><td>{{ "%.2f"|format(val) }}</td></tr>
    {% endfor %}
  </tbody>
</table>
{% endif %}
{% endif %}

<!-- ═══ INCLUSIONS / EXCLUSIONS ═══ -->
{% if project.inclusions or project.exclusions %}
<h2>Le prix comprend / ne comprend pas</h2>
<div class="two-columns">
  <div class="inclusions">
    <h3>✓ Inclus</h3>
    <ul class="inc-list">
      {% for i in (project.inclusions or []) %}<li>{{ i }}</li>{% endfor %}
    </ul>
  </div>
  <div class="exclusions">
    <h3>✗ Non inclus</h3>
    <ul class="exc-list">
      {% for e in (project.exclusions or []) %}<li>{{ e }}</li>{% endfor %}
    </ul>
  </div>
</div>
{% endif %}

<!-- ═══ TERMS & CONDITIONS ═══ -->
<div class="terms">
  <h2>Conditions générales</h2>
  <h3>Validité</h3>
  <p>Cette proposition est valable 15 jours à compter de la date d'émission. Les tarifs sont sujets à modification en cas de variation des taux de change ou des prix fournisseurs.</p>
  
  <h3>Conditions de paiement</h3>
  <ul>
    <li>30% d'acompte à la confirmation</li>
    <li>Solde (70%) au plus tard 30 jours avant le départ</li>
    <li>Paiement par virement bancaire ou carte de crédit</li>
  </ul>
  
  <h3>Politique d'annulation</h3>
  <ul>
    <li>Plus de 60 jours avant le départ : remboursement intégral moins frais de dossier (50€/pax)</li>
    <li>60 à 30 jours : pénalité de 30% du montant total</li>
    <li>30 à 15 jours : pénalité de 50%</li>
    <li>Moins de 15 jours : aucun remboursement</li>
  </ul>
  
  <h3>Substitution hôtelière</h3>
  <p>En cas d'indisponibilité, S'TOURS se réserve le droit de proposer un hébergement de catégorie équivalente ou supérieure sans supplément.</p>
</div>

<!-- ═══ CTA ═══ -->
<div class="cta-box">
  <h3>Prêt à vivre cette aventure ?</h3>
  <p>Contactez votre Travel Designer pour confirmer votre voyage.<br>
  📧 contact@stours.ma | 📞 +212 5 22 XX XX XX</p>
</div>

</body>
</html>"""
