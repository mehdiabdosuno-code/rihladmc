"""Safe condition evaluator for approval rules.

A condition tree is one of:
    {"all": [<cond>, ...]}    — logical AND
    {"any": [<cond>, ...]}    — logical OR
    {"not": <cond>}           — negation
    {"field": "<name>", "op": "<op>", "value": <literal>}  — leaf

Operators: eq | ne | gt | gte | lt | lte | in | nin | contains | starts_with

NEVER uses eval()/exec(). Field lookup walks dicts only — no attribute access.
"""

from numbers import Number
from typing import Any


_OPS = {
    "eq":          lambda a, b: a == b,
    "ne":          lambda a, b: a != b,
    "gt":          lambda a, b: isinstance(a, Number) and a > b,
    "gte":         lambda a, b: isinstance(a, Number) and a >= b,
    "lt":          lambda a, b: isinstance(a, Number) and a < b,
    "lte":         lambda a, b: isinstance(a, Number) and a <= b,
    "in":          lambda a, b: a in b if isinstance(b, (list, tuple, set)) else False,
    "nin":         lambda a, b: a not in b if isinstance(b, (list, tuple, set)) else True,
    "contains":    lambda a, b: isinstance(a, str) and isinstance(b, str) and b in a,
    "starts_with": lambda a, b: isinstance(a, str) and isinstance(b, str) and a.startswith(b),
}


def _resolve_field(snapshot: dict, path: str) -> Any:
    """Dot-notation field lookup (snapshot only — no attribute access)."""
    cur: Any = snapshot
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def matches_conditions(conditions: Any, snapshot: dict) -> bool:
    """Return True if `conditions` matches the entity `snapshot`.

    None / empty conditions → always True (rule matches everything).
    """
    if conditions is None or conditions == {} or conditions == []:
        return True

    if isinstance(conditions, list):
        # implicit AND for top-level lists
        return all(matches_conditions(c, snapshot) for c in conditions)

    if not isinstance(conditions, dict):
        return False

    if "all" in conditions:
        return all(matches_conditions(c, snapshot) for c in conditions["all"] or [])
    if "any" in conditions:
        return any(matches_conditions(c, snapshot) for c in conditions["any"] or [])
    if "not" in conditions:
        return not matches_conditions(conditions["not"], snapshot)

    op = conditions.get("op")
    if op not in _OPS:
        return False
    field = conditions.get("field")
    if not isinstance(field, str):
        return False
    actual = _resolve_field(snapshot, field)
    expected = conditions.get("value")
    try:
        return bool(_OPS[op](actual, expected))
    except Exception:
        return False
