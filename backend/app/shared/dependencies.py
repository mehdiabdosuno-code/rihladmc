"""Shared FastAPI dependencies — auth, RBAC, pagination.

Usage in routers:
    from app.shared.dependencies import require_auth, require_role

    @router.get("/", dependencies=[Depends(require_auth)])
    def list_items(...):
        ...

    @router.delete("/{id}", dependencies=[Depends(require_role("super_admin"))])
    def delete_item(...):
        ...
"""

from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user


async def require_auth(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that enforces JWT authentication.
    Returns the decoded token payload (sub, email, role, permissions).
    """
    return current_user


def require_role(*allowed_roles: str):
    """Factory returning a dependency that enforces role-based access."""
    async def _check_role(current_user: dict = Depends(get_current_user)) -> dict:
        role = current_user.get("role", "")
        if role not in allowed_roles and "super_admin" not in [role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rôle requis : {', '.join(allowed_roles)}",
            )
        return current_user
    return _check_role


def require_permission(permission: str):
    """Factory returning a dependency that enforces a specific permission."""
    async def _check_permission(current_user: dict = Depends(get_current_user)) -> dict:
        perms = current_user.get("permissions", [])
        if "*" not in perms and permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission requise : {permission}",
            )
        return current_user
    return _check_permission
