"""Reviews — clients évaluent guides, chauffeurs, restaurants, hôtels."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.reviews.models import Review, ReviewTarget
from app.modules.notifications.service import push_notification

router = APIRouter(prefix="/reviews", tags=["reviews"], dependencies=[Depends(require_auth)])


class ReviewCreate(BaseModel):
    project_id:  str
    target_type: ReviewTarget
    target_id:   Optional[str] = None
    target_name: str
    rating:      int = Field(..., ge=1, le=5)
    comment:     Optional[str] = None


class ReviewOut(BaseModel):
    id:            str
    project_id:    str
    reviewer_name: str
    target_type:   ReviewTarget
    target_name:   str
    rating:        int
    comment:       Optional[str]
    created_at:    str

    class Config:
        from_attributes = True


@router.post("/", response_model=ReviewOut, status_code=201)
async def create_review(
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    review = Review(
        project_id=data.project_id,
        reviewer_id=current_user["sub"],
        reviewer_name=current_user.get("full_name", "Client"),
        target_type=data.target_type,
        target_id=data.target_id,
        target_name=data.target_name,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Notify travel designer in charge of this project
    await push_notification(
        db=db,
        project_id=data.project_id,
        sender_name=current_user.get("full_name", "Client"),
        notif_type="review",
        title=f"Avis {data.rating}★ — {data.target_name}",
        message=data.comment or f"Note {data.rating}/5 pour {data.target_name}",
    )

    return review


@router.get("/project/{project_id}", response_model=list[ReviewOut])
def get_project_reviews(project_id: str, db: Session = Depends(get_db)):
    rows = db.execute(
        select(Review).where(Review.project_id == project_id)
        .order_by(Review.created_at.desc())
    ).scalars().all()
    return rows


@router.get("/stats/{project_id}")
def get_review_stats(project_id: str, db: Session = Depends(get_db)):
    reviews = db.execute(
        select(Review).where(Review.project_id == project_id)
    ).scalars().all()
    if not reviews:
        return {"count": 0, "average": None, "by_type": {}}
    by_type: dict[str, list[int]] = {}
    for r in reviews:
        by_type.setdefault(r.target_type, []).append(r.rating)
    return {
        "count": len(reviews),
        "average": round(sum(r.rating for r in reviews) / len(reviews), 1),
        "by_type": {k: round(sum(v) / len(v), 1) for k, v in by_type.items()},
    }


# ── NPS & Quality Dashboard ─────────────────────────────────────────

class NPSSurveyRequest(BaseModel):
    """NPS survey: 'Would you recommend S'TOURS to a colleague?'"""
    project_id: str
    nps_score: int = Field(..., ge=0, le=10, description="0-10 NPS score")
    would_rebook: bool = False
    best_moment: Optional[str] = None
    improvement: Optional[str] = None
    overall_comment: Optional[str] = None


@router.post("/nps-survey", summary="Submit NPS survey post-voyage")
async def submit_nps(
    data: NPSSurveyRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    """Submit Net Promoter Score survey after a completed circuit."""
    # Classify NPS
    if data.nps_score >= 9:
        category = "promoter"
    elif data.nps_score >= 7:
        category = "passive"
    else:
        category = "detractor"

    # Store as a review with NPS metadata
    review = Review(
        project_id=data.project_id,
        reviewer_id=current_user["sub"],
        reviewer_name=current_user.get("full_name", "Client"),
        target_type="hotel",  # Use as general feedback
        target_id=None,
        target_name="NPS Survey",
        rating=min(5, max(1, round(data.nps_score / 2))),  # Map 0-10 to 1-5
        comment=f"NPS: {data.nps_score}/10 ({category}) | "
                f"Rebook: {'Oui' if data.would_rebook else 'Non'} | "
                f"Best: {data.best_moment or 'N/A'} | "
                f"Improve: {data.improvement or 'N/A'} | "
                f"{data.overall_comment or ''}",
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    return {
        "nps_score": data.nps_score,
        "category": category,
        "review_id": review.id,
        "feedback": {
            "would_rebook": data.would_rebook,
            "best_moment": data.best_moment,
            "improvement": data.improvement,
        },
    }


@router.get("/nps-dashboard", summary="NPS dashboard — quality metrics")
def nps_dashboard(db: Session = Depends(get_db)):
    """Calculate NPS score and quality metrics across all projects."""
    reviews = db.execute(select(Review)).scalars().all()

    if not reviews:
        return {"nps_score": None, "total_reviews": 0}

    # All reviews
    ratings = [r.rating for r in reviews]
    total = len(ratings)

    # NPS calculation (from reviews containing 'NPS:')
    nps_reviews = [r for r in reviews if r.comment and "NPS:" in r.comment]
    nps_scores = []
    for r in nps_reviews:
        try:
            score = int(r.comment.split("NPS:")[1].split("/")[0].strip())
            nps_scores.append(score)
        except (ValueError, IndexError):
            pass

    nps_score = None
    nps_breakdown = {"promoters": 0, "passives": 0, "detractors": 0}
    if nps_scores:
        for s in nps_scores:
            if s >= 9: nps_breakdown["promoters"] += 1
            elif s >= 7: nps_breakdown["passives"] += 1
            else: nps_breakdown["detractors"] += 1
        pct_promoters = nps_breakdown["promoters"] / len(nps_scores) * 100
        pct_detractors = nps_breakdown["detractors"] / len(nps_scores) * 100
        nps_score = round(pct_promoters - pct_detractors, 1)

    # By target type
    by_type: dict[str, list[int]] = {}
    for r in reviews:
        t = str(r.target_type) if r.target_type else "other"
        by_type.setdefault(t, []).append(r.rating)
    type_averages = {k: round(sum(v) / len(v), 1) for k, v in by_type.items()}

    # Rating distribution
    distribution = {str(i): sum(1 for r in ratings if r == i) for i in range(1, 6)}

    return {
        "nps_score": nps_score,
        "nps_breakdown": nps_breakdown,
        "total_reviews": total,
        "average_rating": round(sum(ratings) / total, 1),
        "by_type": type_averages,
        "rating_distribution": distribution,
        "rebook_intent": None,  # Would require parsing comments
    }
