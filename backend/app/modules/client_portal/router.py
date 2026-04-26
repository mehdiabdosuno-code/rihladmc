"""Client Portal — Interactive B2C proposal viewer.

Generates a secure, shareable link for clients to:
  - View their proposal online (itinerary + map + pricing)
  - Add comments / questions per day
  - Accept or request modifications
  - Sign electronically (simple signature capture)

No login required — access via unique token.
"""

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.modules.projects.models import Project
from app.modules.quotations.models import Quotation, QuotationLine
from app.shared.dependencies import require_auth

# ── Two routers: authenticated (management) + public (client access) ─

router = APIRouter(prefix="/portal", tags=["client-portal"],
                   dependencies=[Depends(require_auth)])
public_router = APIRouter(prefix="/portal/public", tags=["client-portal-public"])

PORTAL_SECRET = "rihla-portal-secret-2024"

# ── In-memory comment store (production would use DB) ────────────────
_comments: dict[str, list[dict]] = {}


def _generate_token(project_id: str) -> str:
    """Generate a secure, deterministic token for a project."""
    raw = f"{project_id}:{PORTAL_SECRET}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _verify_token(project_id: str, token: str) -> bool:
    expected = _generate_token(project_id)
    return hmac.compare_digest(token, expected)


# ── Schemas ──────────────────────────────────────────────────────────

class PortalLink(BaseModel):
    project_id: str
    client_email: Optional[str] = None


class ClientComment(BaseModel):
    day_number: Optional[int] = None
    section: str = "general"  # general | itinerary | pricing | logistics
    author_name: str
    message: str


class ClientSignature(BaseModel):
    signer_name: str
    signer_email: str
    accepted: bool = True
    signature_data: Optional[str] = None  # Base64 image or text


# ── Management endpoints (auth required) ─────────────────────────────

@router.post("/generate-link", summary="Generate client portal link")
def generate_portal_link(data: PortalLink, db: Session = Depends(get_db)):
    """Generate a secure shareable link for a client to view their proposal."""
    project = db.get(Project, data.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    token = _generate_token(data.project_id)
    portal_url = f"/api/portal/public/view/{data.project_id}?token={token}"

    return {
        "project_id": data.project_id,
        "project_name": project.name,
        "client_name": project.client_name,
        "portal_url": portal_url,
        "token": token,
        "share_message": (
            f"Bonjour {project.client_name or ''},\n\n"
            f"Votre proposition de voyage \"{project.name}\" est prête.\n"
            f"Consultez-la ici : {portal_url}\n\n"
            f"N'hésitez pas à laisser vos commentaires directement sur la page.\n\n"
            f"Cordialement,\nL'équipe S'TOURS"
        ),
    }


@router.get("/comments/{project_id}", summary="View all client comments")
def get_comments(project_id: str):
    """View all comments left by the client on their portal."""
    return {
        "project_id": project_id,
        "comments": _comments.get(project_id, []),
        "total": len(_comments.get(project_id, [])),
    }


@router.get("/status/{project_id}", summary="Check portal status")
def portal_status(project_id: str, db: Session = Depends(get_db)):
    """Check if client has viewed, commented, or signed."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    comments = _comments.get(project_id, [])
    return {
        "project_id": project_id,
        "is_signed": project.is_signed,
        "signed_at": project.signed_at,
        "comment_count": len(comments),
        "last_comment": comments[-1] if comments else None,
        "portal_url": f"/api/portal/public/view/{project_id}?token={_generate_token(project_id)}",
    }


# ── Public endpoints (no auth — token-based) ─────────────────────────

@public_router.get("/view/{project_id}", response_class=HTMLResponse,
                   summary="Client proposal viewer")
def view_proposal(project_id: str, token: str = Query(...), db: Session = Depends(get_db)):
    """Public proposal page — accessible via secure token link."""
    if not _verify_token(project_id, token):
        raise HTTPException(403, "Invalid or expired link")

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Proposal not found")

    # Load itinerary
    itin = db.execute(
        select(Itinerary).where(Itinerary.project_id == project_id)
    ).scalars().first()

    days = []
    if itin:
        days = db.execute(
            select(ItineraryDay)
            .where(ItineraryDay.itinerary_id == itin.id)
            .order_by(ItineraryDay.day_number)
        ).scalars().all()

    # Load quotation
    quotation = db.execute(
        select(Quotation)
        .where(Quotation.project_id == project_id)
        .options(selectinload(Quotation.lines))
    ).scalars().first()

    # Build day cards HTML
    days_html = ""
    for d in days:
        days_html += f"""
        <div class="day-card">
          <div class="day-badge">J{d.day_number}</div>
          <div class="day-content">
            <h3>{d.title or d.city or f'Jour {d.day_number}'}</h3>
            <div class="day-city">{d.city or ''}</div>
            <p class="day-desc">{d.description or ''}</p>
            {'<div class="day-hotel">🏨 ' + (d.hotel or '') + '</div>' if d.hotel else ''}
            {'<div class="day-distance">📍 ' + str(d.distance_km) + ' km</div>' if d.distance_km else ''}
          </div>
        </div>"""

    # Pricing HTML
    pricing_html = ""
    if quotation and quotation.pricing_grid:
        grid = quotation.pricing_grid if isinstance(quotation.pricing_grid, list) else []
        for g in grid:
            pricing_html += f"""
            <tr>
              <td>{g.get('basis', g.get('label', ''))}</td>
              <td>{g.get('price_pax', g.get('selling_per_person', 0)):.0f} {quotation.currency}</td>
              <td>{g.get('ss', g.get('single_supplement', 0)):.0f} {quotation.currency}</td>
            </tr>"""
    elif quotation:
        pricing_html = f"""
        <tr>
          <td>{project.pax_count or '-'} pax</td>
          <td>{quotation.price_per_pax or 0:.0f} {quotation.currency}</td>
          <td>{quotation.single_supplement or 0:.0f} {quotation.currency}</td>
        </tr>"""

    # Inclusions / Exclusions
    inclusions = project.inclusions or []
    exclusions = project.exclusions or []
    inc_html = "".join(f"<li>✓ {i}</li>" for i in inclusions) if inclusions else "<li>Voir détails avec votre conseiller</li>"
    exc_html = "".join(f"<li>✗ {e}</li>" for e in exclusions) if exclusions else ""

    # Comments
    comments = _comments.get(project_id, [])
    comments_html = ""
    for c in comments:
        comments_html += f"""
        <div class="comment">
          <strong>{c['author']}</strong> <span class="comment-date">{c['date']}</span>
          <p>{c['message']}</p>
        </div>"""

    duration = f"{project.duration_days or len(days)}J/{project.duration_nights or max(0, len(days)-1)}N"
    map_url = f"/api/maps/circuit/{project_id}?token=internal"

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{project.name} — Votre voyage S'TOURS</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; background: #F7F8FA; color: #2D3748; line-height: 1.6; }}

  .hero {{
    background: linear-gradient(135deg, #1B2A4A 0%, #2D4A7A 100%);
    color: white; padding: 60px 20px; text-align: center;
  }}
  .hero h1 {{ font-size: 32px; margin-bottom: 8px; }}
  .hero .subtitle {{ color: #C5943A; font-size: 18px; font-weight: 600; }}
  .hero .meta {{ color: #CBD5E0; font-size: 14px; margin-top: 12px; }}

  .container {{ max-width: 900px; margin: 0 auto; padding: 0 20px; }}

  .section {{ background: white; border-radius: 16px; padding: 32px; margin: 24px auto;
              max-width: 900px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }}
  .section h2 {{ font-size: 22px; color: #1B2A4A; margin-bottom: 20px;
                 border-bottom: 3px solid #C5943A; padding-bottom: 8px; display: inline-block; }}

  .day-card {{ display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid #EDF2F7; }}
  .day-card:last-child {{ border-bottom: none; }}
  .day-badge {{ background: #1B2A4A; color: #C5943A; width: 48px; height: 48px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center; font-weight: 700;
                font-size: 14px; flex-shrink: 0; }}
  .day-content h3 {{ font-size: 16px; color: #1B2A4A; }}
  .day-city {{ color: #C5943A; font-weight: 600; font-size: 14px; }}
  .day-desc {{ color: #4A5568; font-size: 14px; margin-top: 4px; }}
  .day-hotel, .day-distance {{ font-size: 13px; color: #718096; margin-top: 4px; }}

  .pricing-table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
  .pricing-table th {{ background: #1B2A4A; color: white; padding: 12px 16px; text-align: left; }}
  .pricing-table td {{ padding: 12px 16px; border-bottom: 1px solid #EDF2F7; }}
  .pricing-table tr:hover td {{ background: #F7FAFC; }}

  .inc-exc {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
  .inc-exc ul {{ list-style: none; }}
  .inc-exc li {{ padding: 4px 0; font-size: 14px; }}
  .inc-list li {{ color: #2F855A; }}
  .exc-list li {{ color: #C53030; }}

  .comment-form {{ margin-top: 20px; }}
  .comment-form textarea {{ width: 100%; border: 2px solid #E2E8F0; border-radius: 10px;
                            padding: 12px; font-size: 14px; resize: vertical; min-height: 80px;
                            font-family: inherit; }}
  .comment-form textarea:focus {{ border-color: #C5943A; outline: none; }}
  .comment-form input {{ border: 2px solid #E2E8F0; border-radius: 10px; padding: 10px 14px;
                         font-size: 14px; width: 100%; margin-bottom: 10px; font-family: inherit; }}
  .comment-form input:focus {{ border-color: #C5943A; outline: none; }}
  .btn {{ background: #C5943A; color: white; border: none; padding: 12px 28px; border-radius: 10px;
          font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }}
  .btn:hover {{ background: #A67A2E; }}
  .btn-accept {{ background: #2F855A; }}
  .btn-accept:hover {{ background: #276749; }}

  .comment {{ background: #F7FAFC; border-radius: 10px; padding: 14px; margin-bottom: 10px;
              border-left: 4px solid #C5943A; }}
  .comment strong {{ color: #1B2A4A; }}
  .comment-date {{ color: #A0AEC0; font-size: 12px; margin-left: 8px; }}
  .comment p {{ font-size: 14px; margin-top: 4px; color: #4A5568; }}

  .actions {{ text-align: center; padding: 40px 20px; }}
  .actions p {{ color: #718096; margin-bottom: 16px; }}

  .signature-box {{ border: 2px dashed #CBD5E0; border-radius: 12px; padding: 40px; text-align: center;
                    color: #A0AEC0; margin: 20px 0; cursor: pointer; transition: border-color 0.2s; }}
  .signature-box:hover {{ border-color: #C5943A; }}

  .status-badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px;
                   font-weight: 600; }}
  .status-signed {{ background: #C6F6D5; color: #276749; }}
  .status-pending {{ background: #FEFCBF; color: #975A16; }}

  .footer {{ text-align: center; padding: 40px 20px; color: #A0AEC0; font-size: 13px; }}

  @media (max-width: 600px) {{
    .hero h1 {{ font-size: 24px; }}
    .inc-exc {{ grid-template-columns: 1fr; }}
    .day-card {{ flex-direction: column; }}
  }}
</style>
</head>
<body>

<div class="hero">
  <h1>{project.name}</h1>
  <div class="subtitle">{duration} — {project.destination or 'Maroc'}</div>
  <div class="meta">
    Préparé pour {project.client_name or 'vous'} | {project.pax_count or '-'} personnes
    | <span class="status-badge {'status-signed' if project.is_signed else 'status-pending'}">
      {'✓ Accepté' if project.is_signed else '⏳ En attente de validation'}
    </span>
  </div>
</div>

<div class="section">
  <h2>Programme jour par jour</h2>
  {days_html if days_html else '<p style="color:#718096;">Programme en cours de finalisation.</p>'}
</div>

{'<div class="section"><h2>Tarification</h2><table class="pricing-table"><thead><tr><th>Formule</th><th>Prix / personne</th><th>Supplément single</th></tr></thead><tbody>' + pricing_html + '</tbody></table></div>' if pricing_html else ''}

<div class="section">
  <div class="inc-exc">
    <div>
      <h2>Inclus</h2>
      <ul class="inc-list">{inc_html}</ul>
    </div>
    <div>
      <h2>Non inclus</h2>
      <ul class="exc-list">{exc_html}</ul>
    </div>
  </div>
</div>

<div class="section">
  <h2>Vos questions & commentaires</h2>
  {comments_html if comments_html else '<p style="color:#A0AEC0;">Aucun commentaire pour le moment.</p>'}
  <div class="comment-form">
    <input type="text" id="author-name" placeholder="Votre nom" />
    <textarea id="comment-text" placeholder="Écrivez votre question ou commentaire..."></textarea>
    <button class="btn" onclick="submitComment()">Envoyer</button>
  </div>
</div>

<div class="actions">
  <p>Cette proposition vous convient ?</p>
  <button class="btn btn-accept" onclick="acceptProposal()" style="margin-right:12px;">
    ✓ Accepter la proposition
  </button>
  <button class="btn" onclick="document.getElementById('comment-text').focus()">
    ✎ Demander des modifications
  </button>
</div>

<div class="footer">
  <p>S'TOURS — Destination Management Company Morocco</p>
  <p>Cette proposition est confidentielle et valable 15 jours.</p>
</div>

<script>
const PROJECT_ID = '{project_id}';
const TOKEN = '{token}';

async function submitComment() {{
  const author = document.getElementById('author-name').value || 'Client';
  const message = document.getElementById('comment-text').value;
  if (!message.trim()) return alert('Veuillez écrire un message.');

  const resp = await fetch('/api/portal/public/comment/' + PROJECT_ID + '?token=' + TOKEN, {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify({{ author_name: author, message: message, section: 'general' }})
  }});
  if (resp.ok) {{
    location.reload();
  }} else {{
    alert('Erreur lors de l\\'envoi.');
  }}
}}

async function acceptProposal() {{
  const name = prompt('Votre nom complet pour la signature :');
  if (!name) return;
  const email = prompt('Votre email :');

  const resp = await fetch('/api/portal/public/accept/' + PROJECT_ID + '?token=' + TOKEN, {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify({{ signer_name: name, signer_email: email || '', accepted: true }})
  }});
  if (resp.ok) {{
    alert('Merci ! Votre acceptation a été enregistrée. L\\'équipe S\\'TOURS vous contactera sous 24h.');
    location.reload();
  }} else {{
    alert('Erreur lors de la signature.');
  }}
}}
</script>
</body>
</html>"""
    return HTMLResponse(content=html)


@public_router.post("/comment/{project_id}", summary="Submit a comment")
def submit_comment(
    project_id: str,
    data: ClientComment,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Client submits a comment on their proposal."""
    if not _verify_token(project_id, token):
        raise HTTPException(403, "Invalid token")

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    comment = {
        "id": str(uuid.uuid4())[:8],
        "author": data.author_name,
        "message": data.message,
        "section": data.section,
        "day_number": data.day_number,
        "date": datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M"),
    }

    _comments.setdefault(project_id, []).append(comment)
    return {"success": True, "comment": comment}


@public_router.post("/accept/{project_id}", summary="Accept proposal")
def accept_proposal(
    project_id: str,
    data: ClientSignature,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Client accepts and signs the proposal."""
    if not _verify_token(project_id, token):
        raise HTTPException(403, "Invalid token")

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    now = datetime.now(timezone.utc).isoformat()
    project.is_signed = data.accepted
    project.signed_at = now
    project.signature_data = json.dumps({
        "signer_name": data.signer_name,
        "signer_email": data.signer_email,
        "accepted": data.accepted,
        "signed_at": now,
        "ip": "portal",
    })

    if data.accepted:
        project.status = "won"

    db.commit()

    return {
        "success": True,
        "project_id": project_id,
        "status": "accepted" if data.accepted else "declined",
        "signed_at": now,
        "signer": data.signer_name,
    }
