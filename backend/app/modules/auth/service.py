"""Authentication business logic."""

from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.modules.auth.models import User, Role, RoleEnum
from app.modules.auth.schemas import UserRegisterRequest, UserLoginRequest, UserResponse, PermissionResponse
from app.shared.exceptions import BadRequestError, ConflictError, UnauthorizedError


class AuthService:
    """Authentication service."""

    def __init__(self, db: Session):
        """Initialize with database session."""
        self.db = db

    def register(self, request: UserRegisterRequest) -> UserResponse:
        """
        Register a new user.

        Args:
            request: User registration request

        Returns:
            Created user response

        Raises:
            ConflictError: If email already exists
        """
        # Check if user exists
        existing = self.db.execute(
            select(User).where(User.email == request.email)
        ).scalars().first()
        if existing:
            raise ConflictError(f"User with email {request.email} already exists")

        # Get role
        role = self.db.execute(
            select(Role).where(Role.name == request.role)
        ).scalars().first()
        if not role:
            raise BadRequestError(f"Role {request.role} not found")

        # Create user
        user = User(
            email=request.email,
            full_name=request.full_name,
            password_hash=hash_password(request.password),
            role_id=role.id,
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return self._user_to_response(user)

    def login(self, request: UserLoginRequest) -> tuple[UserResponse, str]:
        """
        Authenticate user and return token.

        Args:
            request: Login request with email and password

        Returns:
            Tuple of (user_response, access_token)

        Raises:
            UnauthorizedError: If credentials are invalid
        """
        # Find user
        user = self.db.execute(
            select(User).where(User.email == request.email)
        ).scalars().first()

        if not user or not verify_password(request.password, user.password_hash):
            raise UnauthorizedError("Invalid email or password")

        if not user.is_active:
            raise UnauthorizedError("User account is inactive")

        claims: dict = {"sub": user.id}

        # Multi-tenant: bake the default company_id into the JWT so every
        # downstream request has tenant context. Falls back gracefully if
        # the user has no company assigned yet (legacy or not enrolled).
        try:
            from app.modules.companies.service import get_default_company_for_user
            default_uc = get_default_company_for_user(self.db, user.id)
            if default_uc:
                claims["company_id"] = default_uc.company_id
                claims["role"] = default_uc.role
        except Exception:
            pass

        token = create_access_token(claims)
        refresh = create_refresh_token(claims)

        return self._user_to_response(user), token, refresh

    def get_user_by_id(self, user_id: str) -> Optional[UserResponse]:
        """Get user by ID."""
        user = self.db.execute(
            select(User).where(User.id == user_id)
        ).scalars().first()
        return self._user_to_response(user) if user else None

    def _user_to_response(self, user: User) -> UserResponse:
        """Convert User model to response schema."""
        permissions = [
            PermissionResponse(
                id=p.id,
                name=p.name,
                module=p.module,
                description=p.description,
            )
            for p in user.role.permissions
        ]

        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
            created_by=user.created_by,
            role=self._role_to_response(user.role),
            permissions=[p.name for p in permissions],
        )

    @staticmethod
    def _role_to_response(role: Role):
        """Convert Role model to response schema."""
        from app.modules.auth.schemas import RoleResponse
        permissions = [
            PermissionResponse(
                id=p.id,
                name=p.name,
                module=p.module,
                description=p.description,
            )
            for p in role.permissions
        ]
        return RoleResponse(
            id=role.id,
            name=role.name,
            description=role.description,
            permissions=permissions,
        )
