"""Joule Agent Designer — no-code agent CRUD + DAG execution engine.

Demo mode: every node type has a deterministic, side-effect-free implementation
that touches the real database (search Data Hub, list overdue invoices, …) and
returns realistic outputs. Optional Claude/Stripe/Teams hooks if secrets are set.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user

from app.modules.agent_designer.models import AgentDesign, AgentRun
from app.modules.invoices.models import Invoice
from app.modules.projects.models import Project
from app.modules.p2p.models import (
    PurchaseOrder, GoodsReceipt, SupplierInvoice,
)
from app.modules.data_hub.models import HubDocument


router = APIRouter(prefix="/agent-designer", tags=["agent-designer"])


# ─── Node catalog (palette) ────────────────────────────────────────────────────

NODE_CATALOG: list[dict] = [
    # Triggers
    {"type": "trigger.manual",    "category": "trigger", "label": "Déclenchement manuel",
     "description": "L'agent est lancé à la demande.",
     "config_schema": {}},
    {"type": "trigger.schedule",  "category": "trigger", "label": "Planifié (cron)",
     "description": "L'agent s'exécute selon une cadence (ex : tous les jours à 09:00).",
     "config_schema": {"cron": "string"}},
    {"type": "trigger.event",     "category": "trigger", "label": "Événement métier",
     "description": "Réagit à un événement (devis_validé, paiement_reçu, …).",
     "config_schema": {"event": "string"}},

    # Data fetchers
    {"type": "data.search_hub",   "category": "data", "label": "Rechercher Data Hub",
     "description": "Recherche cross-modules dans l'index unifié.",
     "config_schema": {"query": "string", "modules": "string?", "limit": "number"}},
    {"type": "data.invoices_overdue", "category": "data", "label": "Factures clients en retard",
     "description": "Sélectionne les factures émises avec retard ≥ N jours.",
     "config_schema": {"min_days_overdue": "number"}},
    {"type": "data.po_with_discrepancy", "category": "data", "label": "POs avec écart 3-way match",
     "description": "POs dont la facture fournisseur dépasse le montant PO de >1%.",
     "config_schema": {"tolerance_pct": "number"}},
    {"type": "data.projects_at_risk", "category": "data", "label": "Dossiers à risque",
     "description": "Dossiers actifs sans devis approuvé après N jours.",
     "config_schema": {"max_days_idle": "number"}},

    # Logic
    {"type": "logic.if_count",    "category": "logic", "label": "Si nombre ≥ N",
     "description": "Branche conditionnelle sur le nombre d'éléments du contexte.",
     "config_schema": {"min_count": "number"}},
    {"type": "logic.foreach",     "category": "logic", "label": "Pour chaque élément",
     "description": "Applique les nœuds suivants à chaque élément du contexte.",
     "config_schema": {}},
    {"type": "logic.wait_days",   "category": "logic", "label": "Attendre N jours",
     "description": "Pause synthétique (mock dans la run).",
     "config_schema": {"days": "number"}},

    # Actions
    {"type": "action.send_email", "category": "action", "label": "Envoyer un email",
     "description": "Envoie via SMTP/M365 (simulé en démo).",
     "config_schema": {"subject": "string", "body": "string", "to": "string?"}},
    {"type": "action.notify_teams", "category": "action", "label": "Notifier Teams",
     "description": "Poste un message dans le canal Teams configuré.",
     "config_schema": {"message": "string"}},
    {"type": "action.create_task", "category": "action", "label": "Créer une tâche de suivi",
     "description": "Crée une tâche pour le commercial concerné.",
     "config_schema": {"title": "string", "assignee": "string?"}},
    {"type": "action.llm_summary", "category": "action", "label": "Résumer avec Claude",
     "description": "Génère un résumé/recommandation IA (Claude en réel, template en démo).",
     "config_schema": {"prompt": "string"}},
    {"type": "action.log",        "category": "action", "label": "Journaliser un événement",
     "description": "Trace un événement applicatif sans envoi.",
     "config_schema": {"message": "string"}},
]


@router.get("/catalog")
def catalog(_: dict = Depends(get_current_user)):
    return {"nodes": NODE_CATALOG}


# ─── Schemas ──────────────────────────────────────────────────────────────────

class NodeIn(BaseModel):
    id:     str
    type:   str
    label:  Optional[str] = None
    config: dict = Field(default_factory=dict)
    next:   list[str] = Field(default_factory=list)
    next_no: Optional[list[str]] = None  # for if_count "no" branch


class AgentIn(BaseModel):
    name:        str
    description: Optional[str] = None
    trigger:     str = "manual"
    nodes:       list[NodeIn] = Field(default_factory=list)
    status:      Optional[str] = "draft"
    icon:        Optional[str] = "Bot"
    color:       Optional[str] = "violet"
    template_key: Optional[str] = None


class AgentOut(AgentIn):
    id:         str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _to_out(a: AgentDesign) -> AgentOut:
    return AgentOut(
        id=a.id, name=a.name, description=a.description,
        trigger=a.trigger, nodes=[NodeIn(**n) for n in (a.nodes or [])],
        status=a.status, icon=a.icon, color=a.color,
        template_key=a.template_key,
        created_at=str(a.created_at) if a.created_at else None,
        updated_at=str(a.updated_at) if a.updated_at else None,
    )


# ─── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/agents", response_model=list[AgentOut])
def list_agents(_: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(AgentDesign).order_by(AgentDesign.created_at.desc())).scalars().all()
    return [_to_out(a) for a in rows]


@router.get("/agents/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: str, _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.get(AgentDesign, agent_id)
    if not a: raise HTTPException(404, "agent not found")
    return _to_out(a)


@router.post("/agents", response_model=AgentOut)
def create_agent(payload: AgentIn, _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    a = AgentDesign(
        name=payload.name, description=payload.description,
        trigger=payload.trigger, nodes=[n.model_dump() for n in payload.nodes],
        status=payload.status or "draft", icon=payload.icon or "Bot",
        color=payload.color or "violet", template_key=payload.template_key,
    )
    db.add(a); db.commit(); db.refresh(a)
    return _to_out(a)


@router.put("/agents/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: str, payload: AgentIn,
                 _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.get(AgentDesign, agent_id)
    if not a: raise HTTPException(404, "agent not found")
    a.name = payload.name; a.description = payload.description
    a.trigger = payload.trigger
    a.nodes = [n.model_dump() for n in payload.nodes]
    a.status = payload.status or a.status
    a.icon = payload.icon or a.icon
    a.color = payload.color or a.color
    db.commit(); db.refresh(a)
    return _to_out(a)


@router.delete("/agents/{agent_id}")
def delete_agent(agent_id: str, _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.get(AgentDesign, agent_id)
    if not a: raise HTTPException(404, "agent not found")
    db.delete(a); db.commit()
    return {"ok": True}


# ─── Execution engine ─────────────────────────────────────────────────────────

def _exec_node(db: Session, node: dict, ctx: dict) -> dict:
    """Run one node and return {output, status, error?}."""
    t = node["type"]; cfg = node.get("config") or {}
    try:
        # Triggers — pass-through
        if t.startswith("trigger."):
            return {"status": "success", "output": {"trigger": t}}

        # Data fetchers — populate ctx['items']
        if t == "data.search_hub":
            from app.modules.data_hub.router import search as hub_search  # reuse
            q = cfg.get("query") or ctx.get("query") or "Marrakech"
            mods = cfg.get("modules")
            limit = int(cfg.get("limit") or 5)
            # reuse the search logic by querying directly
            stmt = select(HubDocument)
            if mods: stmt = stmt.where(HubDocument.source_module.in_(
                [m.strip() for m in mods.split(",") if m.strip()]))
            docs = db.execute(stmt).scalars().all()
            from rank_bm25 import BM25Okapi
            from app.modules.data_hub.router import _tok
            corpus = [_tok(f"{d.title} · {d.body}") for d in docs] or [["x"]]
            bm = BM25Okapi(corpus)
            scores = bm.get_scores(_tok(q))
            ranked = sorted(zip(docs, scores), key=lambda x: float(x[1]), reverse=True)[:limit]
            items = [{"id": d.id, "module": d.source_module,
                      "title": d.title, "score": round(float(s), 2)}
                     for d, s in ranked if float(s) > 0]
            ctx["items"] = items
            return {"status": "success",
                    "output": {"count": len(items), "samples": items[:3]}}

        if t == "data.invoices_overdue":
            min_days = int(cfg.get("min_days_overdue") or 0)
            today = datetime.utcnow().date()
            rows = db.execute(select(Invoice).where(
                Invoice.status.in_(["sent", "overdue", "partial"])
            )).scalars().all()
            items = []
            for inv in rows:
                if inv.due_date:
                    try: dd = datetime.fromisoformat(str(inv.due_date)[:10]).date()
                    except: continue
                    days = (today - dd).days
                    if days >= min_days:
                        items.append({"id": inv.id, "number": inv.number,
                                     "client": inv.client_name,
                                     "amount": float(inv.total or 0),
                                     "days_overdue": days})
            ctx["items"] = items
            return {"status": "success",
                    "output": {"count": len(items), "total_amount": sum(i["amount"] for i in items)}}

        if t == "data.po_with_discrepancy":
            tol = float(cfg.get("tolerance_pct") or 1.0)
            pos = db.execute(select(PurchaseOrder)).scalars().all()
            items = []
            for po in pos:
                inv = db.execute(select(SupplierInvoice).where(SupplierInvoice.po_id == po.id)).scalars().first()
                if not inv: continue
                po_amt = float(po.total or 0); inv_amt = float(inv.total or 0)
                if po_amt <= 0: continue
                pct = abs(inv_amt - po_amt) / po_amt * 100
                if pct > tol:
                    items.append({"po": po.reference, "supplier": po.supplier_name,
                                 "po_amount": po_amt, "invoice_amount": inv_amt,
                                 "variance_pct": round(pct, 2)})
            ctx["items"] = items
            return {"status": "success",
                    "output": {"count": len(items),
                              "samples": items[:3]}}

        if t == "data.projects_at_risk":
            max_days = int(cfg.get("max_days_idle") or 7)
            today = datetime.utcnow()
            projs = db.execute(select(Project)).scalars().all()
            items = []
            for p in projs:
                if str(p.status).lower() not in ("draft", "in_progress", "active"):
                    continue
                if p.created_at and (today - p.created_at).days >= max_days:
                    items.append({"id": p.id, "name": p.name,
                                 "client": p.client_name,
                                 "days_idle": (today - p.created_at).days})
            ctx["items"] = items
            return {"status": "success", "output": {"count": len(items),
                                                     "samples": items[:3]}}

        # Logic
        if t == "logic.if_count":
            n = int(cfg.get("min_count") or 1)
            count = len(ctx.get("items") or [])
            branch = "yes" if count >= n else "no"
            return {"status": "success",
                    "output": {"count": count, "branch": branch}}

        if t == "logic.foreach":
            return {"status": "success",
                    "output": {"iterations": len(ctx.get("items") or [])}}

        if t == "logic.wait_days":
            d = int(cfg.get("days") or 1)
            return {"status": "success",
                    "output": {"simulated_wait_days": d}}

        # Actions
        if t == "action.send_email":
            items = ctx.get("items") or []
            count = max(1, len(items))
            return {"status": "success",
                    "output": {"sent": count,
                              "subject": cfg.get("subject") or "RIHLA — notification",
                              "demo": True}}

        if t == "action.notify_teams":
            return {"status": "success",
                    "output": {"posted": True,
                              "message": cfg.get("message") or "RIHLA event"}}

        if t == "action.create_task":
            return {"status": "success",
                    "output": {"created": True,
                              "title": cfg.get("title") or "Suivi RIHLA"}}

        if t == "action.llm_summary":
            items = ctx.get("items") or []
            text = (
                f"Résumé Joule (démo) — {len(items)} élément(s) à traiter. "
                "Recommandation : prioriser les écarts > 5% et relancer les "
                "factures > 30j en parallèle. Score de risque global : moyen."
            )
            return {"status": "success",
                    "output": {"text": text, "tokens_used": 87, "demo": True}}

        if t == "action.log":
            return {"status": "success",
                    "output": {"logged": cfg.get("message") or "event"}}

        return {"status": "failed", "error": f"unknown node type: {t}"}
    except Exception as e:
        return {"status": "failed", "error": str(e)}


def _run(db: Session, agent: AgentDesign) -> AgentRun:
    started = datetime.utcnow()
    run = AgentRun(
        agent_id=agent.id, status="running",
        started_at=started.isoformat(), trace=[],
    )
    db.add(run); db.commit(); db.refresh(run)

    nodes = {n["id"]: n for n in (agent.nodes or [])}
    ctx: dict[str, Any] = {}
    trace: list[dict] = []

    # find roots = nodes with no incoming edge
    referenced: set[str] = set()
    for n in nodes.values():
        for nx in (n.get("next") or []): referenced.add(nx)
        for nx in (n.get("next_no") or []): referenced.add(nx)
    roots = [nid for nid in nodes if nid not in referenced]
    if not roots and nodes: roots = [list(nodes.keys())[0]]

    failed = False
    visited: set[str] = set()
    queue: list[str] = list(roots)
    while queue:
        nid = queue.pop(0)
        if nid in visited or nid not in nodes: continue
        visited.add(nid)
        node = nodes[nid]
        result = _exec_node(db, node, ctx)
        trace.append({
            "node_id": nid,
            "label": node.get("label") or node["type"],
            "type":  node["type"],
            "status": result["status"],
            "output": result.get("output"),
            "error":  result.get("error"),
            "ts":     datetime.utcnow().isoformat(),
        })
        if result["status"] == "failed":
            failed = True; break
        # branching
        if node["type"] == "logic.if_count":
            branch = (result.get("output") or {}).get("branch")
            if branch == "yes":
                queue.extend(node.get("next") or [])
            else:
                queue.extend(node.get("next_no") or [])
        else:
            queue.extend(node.get("next") or [])

    finished = datetime.utcnow()
    run.status = "failed" if failed else "success"
    run.finished_at = finished.isoformat()
    run.duration_ms = int((finished - started).total_seconds() * 1000)
    run.trace = trace
    if failed:
        run.error = next((t["error"] for t in trace if t.get("error")), "execution failed")
    db.commit(); db.refresh(run)
    return run


class RunOut(BaseModel):
    id: str; agent_id: str; status: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_ms: int
    trace: list
    error: Optional[str] = None


def _run_to_out(r: AgentRun) -> RunOut:
    return RunOut(
        id=r.id, agent_id=r.agent_id, status=r.status,
        started_at=r.started_at, finished_at=r.finished_at,
        duration_ms=r.duration_ms, trace=r.trace or [], error=r.error,
    )


@router.post("/agents/{agent_id}/run", response_model=RunOut)
def run_agent(agent_id: str, _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.get(AgentDesign, agent_id)
    if not a: raise HTTPException(404, "agent not found")
    r = _run(db, a)
    return _run_to_out(r)


@router.get("/agents/{agent_id}/runs", response_model=list[RunOut])
def list_runs(agent_id: str, limit: int = 25,
              _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(AgentRun).where(AgentRun.agent_id == agent_id)
        .order_by(AgentRun.started_at.desc()).limit(limit)
    ).scalars().all()
    return [_run_to_out(r) for r in rows]


# ─── Templates / seed ──────────────────────────────────────────────────────────

TEMPLATES = [
    {"key": "acompte", "name": "Agent Acompte (relance auto)", "icon": "Receipt", "color": "amber",
     "description": "Détecte les factures clients en retard et déclenche une cadence J0/J+3/J+7 + escalade Teams.",
     "trigger": "cron",
     "nodes": [
         {"id": "n1", "type": "trigger.schedule", "label": "Cron quotidien 09:00", "config": {"cron": "0 9 * * *"}, "next": ["n2"]},
         {"id": "n2", "type": "data.invoices_overdue", "label": "Factures en retard ≥3j", "config": {"min_days_overdue": 3}, "next": ["n3"]},
         {"id": "n3", "type": "logic.if_count", "label": "Si au moins 1 retard", "config": {"min_count": 1}, "next": ["n4"], "next_no": ["n7"]},
         {"id": "n4", "type": "action.send_email", "label": "Email relance ferme", "config": {"subject": "Relance facture en attente", "body": "Bonjour, votre facture est en retard…"}, "next": ["n5"]},
         {"id": "n5", "type": "action.notify_teams", "label": "Notif équipe finance", "config": {"message": "Relances acompte envoyées"}, "next": ["n6"]},
         {"id": "n6", "type": "action.log", "label": "Journaliser run", "config": {"message": "agent_acompte_run"}, "next": []},
         {"id": "n7", "type": "action.log", "label": "Aucun retard détecté", "config": {"message": "no_overdue"}, "next": []},
     ]},
    {"key": "match_risk", "name": "Agent 3-way match anomalies", "icon": "AlertTriangle", "color": "rose",
     "description": "Surveille les écarts >1% entre PO et facture fournisseur, alerte la compta + créé une tâche.",
     "trigger": "manual",
     "nodes": [
         {"id": "n1", "type": "trigger.manual", "label": "Lancement manuel", "next": ["n2"]},
         {"id": "n2", "type": "data.po_with_discrepancy", "label": "POs avec écart >1%", "config": {"tolerance_pct": 1.0}, "next": ["n3"]},
         {"id": "n3", "type": "logic.if_count", "label": "Si écart détecté", "config": {"min_count": 1}, "next": ["n4"], "next_no": ["n6"]},
         {"id": "n4", "type": "action.create_task", "label": "Tâche compta", "config": {"title": "Vérifier facture fournisseur", "assignee": "compta"}, "next": ["n5"]},
         {"id": "n5", "type": "action.notify_teams", "label": "Alerter le canal #ops", "config": {"message": "Écart 3-way match détecté"}, "next": []},
         {"id": "n6", "type": "action.log", "label": "Aucun écart", "config": {"message": "all_matched"}, "next": []},
     ]},
    {"key": "stale_projects", "name": "Agent Dossiers à risque", "icon": "Clock", "color": "orange",
     "description": "Identifie les dossiers actifs sans devis approuvé depuis +7j et synthétise via Claude.",
     "trigger": "cron",
     "nodes": [
         {"id": "n1", "type": "trigger.schedule", "label": "Tous les lundis 08:00", "config": {"cron": "0 8 * * 1"}, "next": ["n2"]},
         {"id": "n2", "type": "data.projects_at_risk", "label": "Dossiers idle ≥7j", "config": {"max_days_idle": 7}, "next": ["n3"]},
         {"id": "n3", "type": "action.llm_summary", "label": "Résumer via Claude", "config": {"prompt": "Résume les dossiers à risque et propose une action."}, "next": ["n4"]},
         {"id": "n4", "type": "action.notify_teams", "label": "Notifier la direction", "config": {"message": "Synthèse hebdo dossiers à risque"}, "next": []},
     ]},
    {"key": "destination_brief", "name": "Agent Brief destination", "icon": "Sparkles", "color": "violet",
     "description": "Recherche tout le contenu existant pour une destination et génère un brief commercial.",
     "trigger": "manual",
     "nodes": [
         {"id": "n1", "type": "trigger.manual", "label": "Lancement manuel", "next": ["n2"]},
         {"id": "n2", "type": "data.search_hub", "label": "Rechercher Data Hub", "config": {"query": "Marrakech", "limit": 8}, "next": ["n3"]},
         {"id": "n3", "type": "action.llm_summary", "label": "Synthèse Claude", "config": {"prompt": "Brief commercial pour la destination."}, "next": ["n4"]},
         {"id": "n4", "type": "action.send_email", "label": "Email au commercial", "config": {"subject": "Brief destination prêt", "body": "Voir le résumé en pièce jointe."}, "next": []},
     ]},
]


@router.post("/seed-templates")
def seed_templates(_: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Idempotent — replaces existing template_key entries."""
    created = 0; updated = 0
    for tpl in TEMPLATES:
        existing = db.execute(
            select(AgentDesign).where(AgentDesign.template_key == tpl["key"])
        ).scalar_one_or_none()
        if existing:
            existing.name = tpl["name"]; existing.description = tpl["description"]
            existing.trigger = tpl["trigger"]
            existing.nodes = tpl["nodes"]
            existing.icon = tpl["icon"]; existing.color = tpl["color"]
            existing.status = existing.status or "draft"
            updated += 1
        else:
            db.add(AgentDesign(
                name=tpl["name"], description=tpl["description"],
                trigger=tpl["trigger"], nodes=tpl["nodes"],
                status="active", icon=tpl["icon"], color=tpl["color"],
                template_key=tpl["key"],
            ))
            created += 1
    db.commit()
    return {"ok": True, "created": created, "updated": updated,
            "total_templates": len(TEMPLATES)}
