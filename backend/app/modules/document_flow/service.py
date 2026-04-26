"""Build a document graph for a given project.

The graph chains: Project → Quotation(s) → Proposal(s) → Invoice(s) → Payment(s)

This service is deliberately defensive: it tolerates missing tables/columns
so it can ship before all upstream modules are fully migrated.
"""

from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.document_flow.schemas import FlowEdge, FlowGraph, FlowNode


def _safe_query(db: Session, sql: str, params: dict) -> list:
    try:
        return list(db.execute(text(sql), params).mappings())
    except Exception:
        db.rollback()
        return []


def build_flow(db: Session, project_id: str, company_id: Optional[str] = None) -> FlowGraph:
    nodes: list[FlowNode] = []
    edges: list[FlowEdge] = []

    # Project
    project_rows = _safe_query(
        db,
        "SELECT id, name, status, created_at FROM projects WHERE id = :id"
        + (" AND (company_id = :cid OR company_id IS NULL)" if company_id else ""),
        {"id": project_id, "cid": company_id} if company_id else {"id": project_id},
    )
    if not project_rows:
        return FlowGraph(project_id=project_id, nodes=[], edges=[])

    p = project_rows[0]
    project_node_id = f"project:{p['id']}"
    nodes.append(FlowNode(
        id=project_node_id, type="project",
        label=p.get("name") or "Projet",
        status=p.get("status"), db_id=str(p["id"]),
        created_at=p.get("created_at"),
    ))

    # Quotations
    quotations = _safe_query(
        db,
        "SELECT id, status, total_selling, created_at "
        "FROM quotations WHERE project_id = :pid ORDER BY created_at",
        {"pid": project_id},
    )
    for q in quotations:
        qid = f"quotation:{q['id']}"
        nodes.append(FlowNode(
            id=qid, type="quotation",
            label=f"Devis #{str(q['id'])[:8]}",
            status=q.get("status"),
            amount=float(q["total_selling"]) if q.get("total_selling") is not None else None,
            currency="MAD",
            db_id=str(q["id"]),
            created_at=q.get("created_at"),
        ))
        edges.append(FlowEdge(source=project_node_id, target=qid, label="devis"))

    # Proposals (proposal_shares table)
    proposals = _safe_query(
        db,
        "SELECT id, status, created_at FROM proposal_shares WHERE project_id = :pid",
        {"pid": project_id},
    )
    for pr in proposals:
        prid = f"proposal:{pr['id']}"
        nodes.append(FlowNode(
            id=prid, type="proposal",
            label=f"Proposition #{str(pr['id'])[:8]}",
            status=pr.get("status"),
            db_id=str(pr["id"]),
            created_at=pr.get("created_at"),
        ))
        edges.append(FlowEdge(source=project_node_id, target=prid, label="proposition"))

    # Invoices
    invoices = _safe_query(
        db,
        "SELECT id, quotation_id, status, total, created_at "
        "FROM invoices WHERE project_id = :pid ORDER BY created_at",
        {"pid": project_id},
    )
    for inv in invoices:
        iid = f"invoice:{inv['id']}"
        nodes.append(FlowNode(
            id=iid, type="invoice",
            label=f"Facture #{str(inv['id'])[:8]}",
            status=inv.get("status"),
            amount=float(inv["total"]) if inv.get("total") is not None else None,
            currency="MAD",
            db_id=str(inv["id"]),
            created_at=inv.get("created_at"),
        ))
        # Link to quotation if known, else to project
        if inv.get("quotation_id"):
            edges.append(FlowEdge(
                source=f"quotation:{inv['quotation_id']}", target=iid, label="facturée",
            ))
        else:
            edges.append(FlowEdge(source=project_node_id, target=iid, label="facture"))

    # Payments (best-effort; depends on installed schema)
    payments = _safe_query(
        db,
        "SELECT id, invoice_id, amount, paid_at FROM payments WHERE project_id = :pid",
        {"pid": project_id},
    )
    for pay in payments:
        payid = f"payment:{pay['id']}"
        nodes.append(FlowNode(
            id=payid, type="payment",
            label=f"Règlement #{str(pay['id'])[:8]}",
            amount=float(pay["amount"]) if pay.get("amount") is not None else None,
            currency="MAD",
            db_id=str(pay["id"]),
            created_at=pay.get("paid_at"),
        ))
        if pay.get("invoice_id"):
            edges.append(FlowEdge(
                source=f"invoice:{pay['invoice_id']}", target=payid, label="règlement",
            ))

    return FlowGraph(project_id=project_id, nodes=nodes, edges=edges)
