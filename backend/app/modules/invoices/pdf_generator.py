"""Invoice PDF Generator — RIHLA Tourist Platform.

Layout exact du modèle S'TOURS:
  - En-tête : logo RIHLA centré
  - Corps   : infos client + tableau lignes + totaux
  - Pied    : 3 colonnes (société | Casablanca HQ | Marrakech Office)
  - Filigrane BROUILLON si statut draft
"""

import os, io, base64, uuid
from pathlib import Path
from datetime import datetime
from typing import Optional

EXPORT_DIR = Path("exports/invoices")
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

# ── Brand colours ─────────────────────────────────────────────────
RIHLA_RED   = (192, 57, 43)     # #C0392B
RIHLA_GREY  = (85,  85, 85)     # #555555
INK         = (20,  20, 20)     # #141414
WARM        = (255, 254, 233)   # #FFFEE9
LINE_GREY   = (220, 220, 215)
STOURS_ORANGE = (240, 150, 30)  # from S'TOURS palette

# ── Embedded logos (base64) ───────────────────────────────────────
_DIR = Path(__file__).parent

def _get_logo_b64() -> str:
    logo_path = Path(__file__).parent.parent.parent.parent.parent / "frontend/src/assets/rihla_logo.png"
    if logo_path.exists():
        with open(logo_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    return ""

def _get_footer_b64() -> str:
    footer_path = Path(__file__).parent / "footer_stours.png"
    if footer_path.exists():
        with open(footer_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    return ""


def generate_invoice_pdf(invoice_data: dict) -> Path:
    """Generate a PDF invoice and return its path."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm, mm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle,
            Paragraph, Spacer, HRFlowable, Image,
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors as rl_colors
        from reportlab.platypus import Flowable
        from reportlab.pdfgen import canvas as rl_canvas
    except ImportError:
        raise RuntimeError("reportlab non installé — pip install reportlab")

    # ── Setup ────────────────────────────────────────────────────
    number   = invoice_data.get("number", "FAC-0000-0000")
    filename = EXPORT_DIR / f"invoice_{number.replace('-','_')}.pdf"

    c_red   = rl_colors.Color(RIHLA_RED[0]/255,   RIHLA_RED[1]/255,   RIHLA_RED[2]/255)
    c_grey  = rl_colors.Color(RIHLA_GREY[0]/255,  RIHLA_GREY[1]/255,  RIHLA_GREY[2]/255)
    c_ink   = rl_colors.Color(INK[0]/255,          INK[1]/255,         INK[2]/255)
    c_line  = rl_colors.Color(LINE_GREY[0]/255,    LINE_GREY[1]/255,   LINE_GREY[2]/255)
    c_orange= rl_colors.Color(STOURS_ORANGE[0]/255,STOURS_ORANGE[1]/255,STOURS_ORANGE[2]/255)
    c_white = rl_colors.white
    c_light = rl_colors.Color(0.97, 0.97, 0.96)

    styles = getSampleStyleSheet()
    W, H   = A4  # 595.27 x 841.89

    def ps(name, **kw):
        return ParagraphStyle(name, **kw)

    title_st  = ps("title",  fontSize=22, textColor=c_red,  fontName="Helvetica-Bold",  spaceAfter=2)
    sub_st    = ps("sub",    fontSize=9,  textColor=c_grey,  fontName="Helvetica",       spaceAfter=4)
    label_st  = ps("label",  fontSize=8,  textColor=c_grey,  fontName="Helvetica-Bold",
                             textTransform="uppercase", spaceBefore=2)
    value_st  = ps("value",  fontSize=10, textColor=c_ink,   fontName="Helvetica",       spaceAfter=2)
    bold_st   = ps("bold",   fontSize=10, textColor=c_ink,   fontName="Helvetica-Bold",  spaceAfter=2)
    small_st  = ps("small",  fontSize=8,  textColor=c_grey,  fontName="Helvetica")
    footer_st = ps("footer", fontSize=7.5,textColor=c_grey,  fontName="Helvetica",       leading=11)
    footer_bold=ps("footerb",fontSize=7.5,textColor=c_orange,fontName="Helvetica-Bold",  leading=11)

    # ── Build story ───────────────────────────────────────────────
    story = []

    # Logo RIHLA
    logo_b64 = _get_logo_b64()
    if logo_b64:
        logo_data = base64.b64decode(logo_b64)
        logo_img  = Image(io.BytesIO(logo_data), width=7*cm, height=1.7*cm)
        logo_img.hAlign = "CENTER"
        story.append(logo_img)
    else:
        story.append(Paragraph("RIHLA TOURIST PLATFORM", title_st))

    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_red, spaceAfter=8))

    # Invoice title + number row
    inv_title_data = [[
        Paragraph(f"<b>FACTURE</b>", ps("it", fontSize=18, textColor=c_red, fontName="Helvetica-Bold")),
        Paragraph(f"<b>{number}</b>", ps("in", fontSize=14, textColor=c_ink, fontName="Helvetica-Bold",
                                          alignment=2)),
    ]]
    inv_title_tbl = Table(inv_title_data, colWidths=[9*cm, 8*cm])
    inv_title_tbl.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    story.append(inv_title_tbl)
    story.append(Spacer(1, 0.3*cm))

    # Meta row: dates / project ref
    issue_date   = invoice_data.get("issue_date", datetime.now().strftime("%d/%m/%Y"))
    due_date     = invoice_data.get("due_date", "")
    travel_dates = invoice_data.get("travel_dates", "")
    project_ref  = invoice_data.get("project_reference", "")

    meta_data = [
        [Paragraph("Date d'émission", label_st), Paragraph(issue_date or "–", value_st),
         Paragraph("Référence projet", label_st), Paragraph(project_ref or "–", value_st)],
        [Paragraph("Date d'échéance", label_st), Paragraph(due_date or "–", value_st),
         Paragraph("Dates de voyage", label_st), Paragraph(travel_dates or "–", value_st)],
    ]
    meta_tbl = Table(meta_data, colWidths=[4*cm, 5*cm, 4*cm, 4*cm])
    meta_tbl.setStyle(TableStyle([
        ("FONTSIZE",  (0,0),(-1,-1), 8),
        ("VALIGN",    (0,0),(-1,-1), "TOP"),
        ("TOPPADDING",(0,0),(-1,-1), 3),
        ("BOTTOMPADDING",(0,0),(-1,-1), 3),
    ]))
    story.append(meta_tbl)
    story.append(HRFlowable(width="100%", thickness=0.5, color=c_line, spaceAfter=8, spaceBefore=8))

    # Client block
    client_name    = invoice_data.get("client_name", "")
    client_email   = invoice_data.get("client_email", "")
    client_address = invoice_data.get("client_address", "")
    pax_count      = invoice_data.get("pax_count")
    currency       = invoice_data.get("currency", "EUR")
    sym            = {"EUR":"€","USD":"$","GBP":"£","MAD":"MAD"}.get(currency, currency)

    client_block = [
        [Paragraph("FACTURÉ À", label_st),  Paragraph("DÉTAILS DU GROUPE", label_st)],
        [Paragraph(f"<b>{client_name}</b>",  bold_st),
         Paragraph(f"PAX : <b>{pax_count or '–'}</b>", bold_st)],
        [Paragraph(client_email or "–",      small_st),
         Paragraph(f"Devise : <b>{currency}</b>", small_st)],
        [Paragraph((client_address or "–").replace("\n","<br/>"), small_st),
         Paragraph("", small_st)],
    ]
    client_tbl = Table(client_block, colWidths=[9*cm, 8*cm])
    client_tbl.setStyle(TableStyle([
        ("BACKGROUND",  (0,0),(-1,0), c_light),
        ("TOPPADDING",  (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("LEFTPADDING", (0,0),(-1,-1), 6),
        ("VALIGN",      (0,0),(-1,-1), "TOP"),
    ]))
    story.append(client_tbl)
    story.append(Spacer(1, 0.5*cm))

    # ── Lines table ───────────────────────────────────────────────
    lines = invoice_data.get("lines", [])
    tbl_header = ["Description", "Qté", "P.U.", f"Total ({sym})"]
    tbl_data   = [tbl_header]

    for line in lines:
        label      = line.get("label", "")
        qty        = line.get("qty", 1)
        unit_price = float(line.get("unit_price", 0))
        total_line = float(line.get("total", qty * unit_price))
        tbl_data.append([
            Paragraph(label, value_st),
            Paragraph(str(qty), value_st),
            Paragraph(f"{unit_price:,.2f}", value_st),
            Paragraph(f"{total_line:,.2f}", bold_st),
        ])

    if not lines:
        tbl_data.append([Paragraph("Prestations touristiques selon programme", value_st),
                         "1", "–", "–"])

    lines_tbl = Table(tbl_data, colWidths=[10*cm, 2*cm, 3*cm, 2.5*cm])
    lines_tbl.setStyle(TableStyle([
        # Header
        ("BACKGROUND",    (0,0), (-1,0),  rl_colors.Color(INK[0]/255,INK[1]/255,INK[2]/255)),
        ("TEXTCOLOR",     (0,0), (-1,0),  c_white),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8.5),
        ("ALIGN",         (1,0), (-1,-1), "RIGHT"),
        ("ALIGN",         (0,0), (0,-1),  "LEFT"),
        # Rows
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [rl_colors.white, c_light]),
        ("GRID",          (0,0), (-1,-1), 0.3, c_line),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("RIGHTPADDING",  (0,0), (-1,-1), 6),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(lines_tbl)
    story.append(Spacer(1, 0.4*cm))

    # ── Totals block ──────────────────────────────────────────────
    subtotal      = float(invoice_data.get("subtotal", 0))
    tax_rate      = float(invoice_data.get("tax_rate", 0))
    tax_amount    = subtotal * tax_rate / 100
    total         = subtotal + tax_amount
    deposit_pct   = float(invoice_data.get("deposit_pct", 30))
    deposit_amt   = total * deposit_pct / 100
    balance_due   = total - deposit_amt
    price_per_pax = float(invoice_data.get("price_per_pax", 0))

    def money(v): return f"{sym} {v:,.2f}"

    totals_data = []
    totals_data.append(["Sous-total",      money(subtotal)])
    if tax_rate > 0:
        totals_data.append([f"TVA ({tax_rate:.0f}%)", money(tax_amount)])
    totals_data.append(["TOTAL TTC",       money(total)])
    if deposit_pct > 0:
        totals_data.append([f"Acompte ({deposit_pct:.0f}%)", money(deposit_amt)])
        totals_data.append(["SOLDE À RÉGLER", money(balance_due)])
    if price_per_pax > 0 and pax_count:
        totals_data.append([f"Prix / pax ({pax_count} pax)", money(price_per_pax)])

    tot_tbl = Table(totals_data, colWidths=[5*cm, 4*cm], hAlign="RIGHT")
    tot_style = TableStyle([
        ("ALIGN",         (0,0), (-1,-1), "RIGHT"),
        ("FONTSIZE",      (0,0), (-1,-1), 9),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("LINEABOVE",     (0,2), (-1,2),  1, c_red),
        ("BACKGROUND",    (0,2), (-1,2),  rl_colors.Color(0.97,0.92,0.90)),
        ("FONTNAME",      (0,2), (-1,2),  "Helvetica-Bold"),
        ("TEXTCOLOR",     (0,2), (-1,2),  c_red),
    ])
    if deposit_pct > 0:
        tot_style.add("FONTNAME",   (0,4),(1,4),  "Helvetica-Bold")
        tot_style.add("BACKGROUND", (0,4),(-1,4),  rl_colors.Color(0.92,0.95,0.98))
        tot_style.add("LINEABOVE",  (0,4),(-1,4),  0.5, c_line)
    tot_tbl.setStyle(tot_style)
    story.append(tot_tbl)

    # Payment terms
    payment_terms = invoice_data.get("payment_terms",
        "Virement bancaire · Paiement en ligne · 30% à la confirmation, solde 15 jours avant départ")
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=c_line, spaceAfter=6))
    story.append(Paragraph(f"<b>Conditions de paiement :</b> {payment_terms}", small_st))

    notes = invoice_data.get("notes","")
    if notes:
        story.append(Spacer(1, 0.2*cm))
        story.append(Paragraph(f"<i>{notes}</i>", small_st))

    story.append(Spacer(1, 1.5*cm))

    # ── Footer table (3 columns like S'TOURS template) ────────────
    footer_data = [[
        # Col 1 - Société
        Paragraph(
            "<b>RIHLA TOURIST PLATFORM</b><br/>"
            "Capital de 2 000 000 MAD - R.C.: 44367<br/>"
            "I.F.: 01000972 - ICE: 001542976000081<br/>"
            "Patente: 357 10095 - CNSS: 1 125899",
            footer_st
        ),
        # Col 2 - Casablanca
        Paragraph(
            "<b><font color='#F0961E'>Casablanca H.Q</font></b><br/>"
            "4, rue Turgot - Quartier Racine, 20100<br/>"
            "Tél.: (+212) 522 95 40 00<br/>"
            "Email: contact@stours.ma",
            footer_st
        ),
        # Col 3 - Marrakech
        Paragraph(
            "<b><font color='#F0961E'>Marrakech Office</font></b><br/>"
            "61, rue Yougoslavie - Immeuble F - Guéliz<br/>"
            "Tél.: (+212) 524 43 67 46<br/>"
            "Email: contact@stours.ma",
            footer_st
        ),
    ]]

    footer_tbl = Table(footer_data, colWidths=[W/3 - 1.5*cm]*3)
    footer_tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 6),
        ("RIGHTPADDING",  (0,0),(-1,-1), 6),
        ("LINEABOVE",     (0,0),(-1,0),  1.5, c_orange),
        ("LINEABOVE",     (1,0),(1,0),   0,   c_white),  # hide inner top lines
        ("LINEBEFORE",    (1,0),(1,0),   0.5, c_line),   # vertical separators
        ("LINEBEFORE",    (2,0),(2,0),   0.5, c_line),
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
    ]))
    story.append(footer_tbl)

    # ── Build PDF ─────────────────────────────────────────────────
    is_draft = invoice_data.get("status", "draft") == "draft"

    def add_watermark(canvas_obj, doc):
        if not is_draft:
            return
        canvas_obj.saveState()
        canvas_obj.setFont("Helvetica-Bold", 72)
        canvas_obj.setFillColorRGB(0.85, 0.85, 0.85, alpha=0.25)
        canvas_obj.translate(W/2, H/2)
        canvas_obj.rotate(35)
        canvas_obj.drawCentredString(0, 0, "BROUILLON")
        canvas_obj.restoreState()

    doc = SimpleDocTemplate(
        str(filename),
        pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=1.5*cm,  bottomMargin=1.5*cm,
    )
    doc.build(story, onFirstPage=add_watermark, onLaterPages=add_watermark)
    return filename
