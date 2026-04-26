"""Companies router — CRUD + switching."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth, require_role
from app.modules.auth.models import User
from app.modules.companies.models import Company, UserCompany
from app.modules.companies.schemas import (
    CompanyCreate,
    CompanyOut,
    CompanyUpdate,
    CompanyWithRoleOut,
    SwitchCompanyRequest,
    SwitchCompanyResponse,
)
from app.modules.companies.service import (
    assert_user_in_company,
    issue_tokens_for_company,
    list_user_companies,
)

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/me", response_model=list[CompanyWithRoleOut])
def list_my_companies(
    current=Depends(require_auth),
    db: Session = Depends(get_db),
):
    """List companies the authenticated user belongs to."""
    rows = list_user_companies(db, current["sub"])
    out: list[CompanyWithRoleOut] = []
    for company, uc in rows:
        out.append(
            CompanyWithRoleOut.model_validate(
                {
                    **company.__dict__,
                    "user_role": uc.role,
                    "is_default": uc.is_default,
                }
            )
        )
    return out


@router.post("/switch", response_model=SwitchCompanyResponse)
def switch_company(
    payload: SwitchCompanyRequest,
    current=Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Switch the user's active company and re-issue tokens carrying company_id."""
    user = db.query(User).filter(User.id == current["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    try:
        uc = assert_user_in_company(db, user.id, payload.company_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company or not company.is_active:
        raise HTTPException(status_code=404, detail="Société introuvable ou inactive")

    access, refresh = issue_tokens_for_company(db, user, company, uc.role)
    return SwitchCompanyResponse(
        access_token=access,
        refresh_token=refresh,
        company=CompanyWithRoleOut.model_validate(
            {**company.__dict__, "user_role": uc.role, "is_default": uc.is_default},
        ),
    )


@router.get("", response_model=list[CompanyOut])
def list_companies(
    _=Depends(require_role("super_admin", "director")),
    db: Session = Depends(get_db),
):
    """List ALL companies (super_admin / director only)."""
    return db.query(Company).order_by(Company.name).all()


@router.post("", response_model=CompanyOut, status_code=201)
def create_company(
    payload: CompanyCreate,
    _=Depends(require_role("super_admin")),
    db: Session = Depends(get_db),
):
    if db.query(Company).filter(Company.code == payload.code).first():
        raise HTTPException(status_code=409, detail="Code société déjà utilisé")
    company = Company(**payload.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: str,
    _=Depends(require_auth),
    current_cid: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    if company_id != current_cid:
        # Restrict cross-company reads to super_admin only
        raise HTTPException(status_code=403, detail="Accès refusé à cette société")
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Société introuvable")
    return company


@router.patch("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: str,
    payload: CompanyUpdate,
    _=Depends(require_role("super_admin", "director")),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Société introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return company
