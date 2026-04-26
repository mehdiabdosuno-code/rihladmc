"""Service layer for Company switching & management."""

from datetime import timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.core.security import create_access_token, create_refresh_token
from app.modules.auth.models import User
from app.modules.companies.models import Company, UserCompany


def list_user_companies(db: Session, user_id: str) -> list[tuple[Company, UserCompany]]:
    rows = (
        db.query(Company, UserCompany)
        .join(UserCompany, UserCompany.company_id == Company.id)
        .filter(UserCompany.user_id == user_id, Company.is_active.is_(True))
        .order_by(UserCompany.is_default.desc(), Company.name.asc())
        .all()
    )
    return rows


def get_default_company_for_user(db: Session, user_id: str) -> Optional[UserCompany]:
    return (
        db.query(UserCompany)
        .filter(UserCompany.user_id == user_id)
        .order_by(UserCompany.is_default.desc(), UserCompany.created_at.asc())
        .first()
    )


def assert_user_in_company(db: Session, user_id: str, company_id: str) -> UserCompany:
    uc = (
        db.query(UserCompany)
        .filter(
            UserCompany.user_id == user_id,
            UserCompany.company_id == company_id,
        )
        .first()
    )
    if not uc:
        raise PermissionError("User is not a member of this company")
    return uc


def issue_tokens_for_company(
    db: Session, user: User, company: Company, role: str,
) -> tuple[str, str]:
    """Issue access + refresh tokens carrying the selected company_id."""
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": role,
        "company_id": company.id,
    }
    access = create_access_token(payload)
    refresh = create_refresh_token({"sub": user.id, "company_id": company.id})
    return access, refresh
