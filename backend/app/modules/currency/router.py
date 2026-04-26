"""Multi-Currency Engine — Dynamic exchange rates for quotation pricing.

Supports EUR, USD, GBP, MAD, CHF, CAD, AED with:
  - Live ECB rates (fetched daily, cached 24h)
  - Fallback to built-in reference rates if ECB unavailable
  - Convert any quotation pricing result to target currency
  - Margin adjustment per currency (hedge protection)

Endpoints:
  GET  /currency/rates              — Current exchange rates (ECB + fallback)
  POST /currency/convert            — Convert amount between currencies
  POST /currency/convert-quotation  — Re-price a full quotation in target currency
  GET  /currency/supported          — List supported currencies
"""

import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.shared.dependencies import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/currency",
    tags=["currency"],
)

# ── Built-in fallback rates (EUR base, updated manually as reference) ──
FALLBACK_RATES = {
    "EUR": 1.0,
    "USD": 1.08,
    "GBP": 0.86,
    "MAD": 10.85,
    "CHF": 0.97,
    "CAD": 1.48,
    "AED": 3.97,
    "SAR": 4.05,
    "JPY": 163.50,
    "CNY": 7.85,
}

CURRENCY_INFO = {
    "EUR": {"name": "Euro", "symbol": "€", "decimals": 2},
    "USD": {"name": "US Dollar", "symbol": "$", "decimals": 2},
    "GBP": {"name": "British Pound", "symbol": "£", "decimals": 2},
    "MAD": {"name": "Dirham Marocain", "symbol": "DH", "decimals": 2},
    "CHF": {"name": "Franc Suisse", "symbol": "CHF", "decimals": 2},
    "CAD": {"name": "Dollar Canadien", "symbol": "CA$", "decimals": 2},
    "AED": {"name": "Dirham Émirati", "symbol": "AED", "decimals": 2},
    "SAR": {"name": "Riyal Saoudien", "symbol": "SAR", "decimals": 2},
    "JPY": {"name": "Yen Japonais", "symbol": "¥", "decimals": 0},
    "CNY": {"name": "Yuan Chinois", "symbol": "¥", "decimals": 2},
}

# ── Rate cache ────────────────────────────────────────────────────────
_rate_cache: dict = {}
_cache_ts: float = 0
_CACHE_TTL = 86400  # 24 hours


async def _fetch_ecb_rates() -> dict[str, float]:
    """Fetch latest ECB exchange rates (XML feed)."""
    global _rate_cache, _cache_ts

    if _rate_cache and (time.time() - _cache_ts) < _CACHE_TTL:
        return _rate_cache

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
            )
            resp.raise_for_status()

        # Parse XML rates
        import xml.etree.ElementTree as ET
        root = ET.fromstring(resp.text)
        ns = {"gesmes": "http://www.gesmes.org/xml/2002-08-01",
              "ecb": "http://www.ecb.int/vocabulary/2002-08-01/eurofxref"}

        rates = {"EUR": 1.0}
        for cube in root.findall(".//ecb:Cube[@currency]", ns):
            currency = cube.get("currency")
            rate = float(cube.get("rate"))
            if currency in CURRENCY_INFO:
                rates[currency] = rate

        # Add MAD if not in ECB (it usually isn't)
        if "MAD" not in rates:
            rates["MAD"] = FALLBACK_RATES["MAD"]

        _rate_cache = rates
        _cache_ts = time.time()
        logger.info("ECB rates refreshed: %d currencies", len(rates))
        return rates

    except Exception as e:
        logger.warning("ECB fetch failed, using fallback: %s", e)
        _rate_cache = FALLBACK_RATES.copy()
        _cache_ts = time.time()
        return _rate_cache


def _get_rates_sync() -> dict[str, float]:
    """Synchronous fallback for non-async contexts."""
    if _rate_cache and (time.time() - _cache_ts) < _CACHE_TTL:
        return _rate_cache
    return FALLBACK_RATES.copy()


def convert(amount: float, from_curr: str, to_curr: str, rates: Optional[dict] = None) -> float:
    """Convert amount between currencies."""
    if from_curr == to_curr:
        return round(amount, 2)

    r = rates or _get_rates_sync()
    from_rate = r.get(from_curr, 1.0)
    to_rate = r.get(to_curr, 1.0)

    # Convert via EUR as base
    eur_amount = amount / from_rate
    result = eur_amount * to_rate

    decimals = CURRENCY_INFO.get(to_curr, {}).get("decimals", 2)
    return round(result, decimals)


# ── Schemas ───────────────────────────────────────────────────────────

class ConvertRequest(BaseModel):
    amount: float
    from_currency: str = "EUR"
    to_currency: str = "MAD"


class QuotationConvertRequest(BaseModel):
    """Convert a full pricing engine result to target currency."""
    pricing_result: dict
    target_currency: str = "MAD"
    hedge_margin_pct: float = Field(default=0, ge=0, le=10,
        description="Extra margin to hedge currency risk")


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/rates", summary="Current exchange rates")
async def get_rates():
    """Fetch current rates (ECB live or fallback)."""
    rates = await _fetch_ecb_rates()
    return {
        "base": "EUR",
        "rates": rates,
        "source": "ECB" if len(rates) > len(FALLBACK_RATES) - 2 else "fallback",
        "cached": (time.time() - _cache_ts) < _CACHE_TTL if _cache_ts else False,
        "updated_at": datetime.fromtimestamp(_cache_ts, tz=timezone.utc).isoformat() if _cache_ts else None,
    }


@router.post("/convert", summary="Convert amount between currencies")
async def convert_amount(data: ConvertRequest):
    """Convert a single amount between currencies."""
    rates = await _fetch_ecb_rates()
    result = convert(data.amount, data.from_currency, data.to_currency, rates)

    from_info = CURRENCY_INFO.get(data.from_currency, {})
    to_info = CURRENCY_INFO.get(data.to_currency, {})

    return {
        "original": {
            "amount": data.amount,
            "currency": data.from_currency,
            "formatted": f"{data.amount:,.2f} {from_info.get('symbol', data.from_currency)}",
        },
        "converted": {
            "amount": result,
            "currency": data.to_currency,
            "formatted": f"{result:,.{to_info.get('decimals', 2)}f} {to_info.get('symbol', data.to_currency)}",
        },
        "rate": rates.get(data.to_currency, 1.0) / rates.get(data.from_currency, 1.0),
    }


@router.post("/convert-quotation", summary="Convert full quotation pricing to target currency",
             dependencies=[Depends(require_auth)])
async def convert_quotation(data: QuotationConvertRequest):
    """Convert all prices in a pricing engine result to target currency.

    Applies optional hedge margin on top of the conversion.
    """
    rates = await _fetch_ecb_rates()
    source_currency = data.pricing_result.get("currency", "EUR")
    target = data.target_currency
    hedge = 1 + (data.hedge_margin_pct / 100)

    to_info = CURRENCY_INFO.get(target, {})
    dec = to_info.get("decimals", 2)

    converted_ranges = []
    for rng in data.pricing_result.get("ranges", []):
        c_rng = dict(rng)
        for key in ["cost_per_person", "cost_total_group", "selling_per_person",
                     "selling_total_group", "margin_per_pax", "margin_total"]:
            if key in c_rng:
                c_rng[key] = round(
                    convert(c_rng[key], source_currency, target, rates) * hedge, dec
                )

        # Convert by_category
        if "by_category" in c_rng:
            c_rng["by_category"] = {
                k: round(convert(v, source_currency, target, rates) * hedge, dec)
                for k, v in c_rng["by_category"].items()
            }

        c_rng["currency"] = target
        converted_ranges.append(c_rng)

    # Convert comparison
    converted_comparison = []
    for comp in data.pricing_result.get("comparison", []):
        c_comp = dict(comp)
        for key in ["cost_per_person", "selling_per_person", "total_group"]:
            if key in c_comp:
                c_comp[key] = round(
                    convert(c_comp[key], source_currency, target, rates) * hedge, dec
                )
        converted_comparison.append(c_comp)

    rate_used = rates.get(target, 1.0) / rates.get(source_currency, 1.0)

    return {
        "success": True,
        "source_currency": source_currency,
        "target_currency": target,
        "rate_used": round(rate_used, 6),
        "hedge_margin_pct": data.hedge_margin_pct,
        "effective_rate": round(rate_used * hedge, 6),
        "data": {
            "ranges": converted_ranges,
            "comparison": converted_comparison,
        },
    }


@router.get("/supported", summary="List supported currencies")
def supported_currencies():
    """List all supported currencies with metadata."""
    return {
        "currencies": CURRENCY_INFO,
        "default": "EUR",
        "dmc_local": "MAD",
    }
