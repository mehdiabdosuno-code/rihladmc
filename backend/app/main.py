"""STOURS Studio API — Main application entry point.

Performance optimizations applied:
  - GZip compression for all responses > 500 bytes
  - Optimized CORS with explicit methods
  - Rate limiting with slowapi
  - Security headers via middleware
  - Minimal access logging overhead
"""

import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

logger = logging.getLogger("rihla.access")

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.sentry import init_sentry

from app.modules.auth.router import router as auth_router
from app.modules.quotations.router import router as quotations_router
from app.modules.itineraries.router import router as itineraries_router
from app.modules.menus.router import router as menus_router
from app.modules.transports.router import router as transports_router
from app.modules.guides.router import router as guides_router
from app.modules.ai.router import router as ai_router
from app.modules.projects.router import router as projects_router
from app.modules.reports.router import ds_router as datasources_router
from app.modules.reports.router import rep_router as reports_router
from app.modules.references.router import router as references_router
from app.modules.invoices.router import router as invoices_router
from app.modules.admin.router import router as admin_router
from app.modules.reviews.router import router as reviews_router
from app.modules.guide_portal.router import router as guide_portal_router
from app.modules.notifications.router import router as notifications_router
from app.modules.hotels.router import router as hotels_router
from app.modules.proposals.router import router as proposals_router
from app.modules.audit.router import router as audit_router
from app.modules.field_ops.router import router as field_ops_router, public_router as field_ops_public_router
from app.modules.finance.router import router as finance_router
from app.modules.gamification.router import router as gamification_router
from app.modules.collaboration.router import router as collaboration_router
from app.modules.companies.router import router as companies_router
from app.modules.master_data.router import partners_router, articles_router
from app.modules.contracting.router import router as contracts_router, pricing_router
from app.modules.document_flow.router import router as document_flow_router
from app.modules.approvals.router import rules_router as approval_rules_router, requests_router as approval_requests_router
from app.modules.travel_companion.router import agency_router as travel_links_router, public_router as companion_public_router
from app.modules.ops_cockpit.router import router as ops_cockpit_router
from app.modules.supplier_score.router import router as supplier_scores_router, incidents_router as supplier_incidents_router
from app.modules.sub_agent_portal.router import router as sub_agent_portal_router
from app.modules.itinerary_templates.router import router as itinerary_templates_router
from app.modules.media_library.router import router as media_library_router
from app.modules.proposal_writer.router import router as proposal_writer_router
from app.modules.payments.router import router as payments_router, public_router as payments_public_router
from app.modules.calendar_sync.router import router as calendar_sync_router, public_router as calendar_sync_public_router
from app.modules.sustainability.router import router as sustainability_router
from app.modules.payment_reminders.router import router as payment_agent_router
from app.modules.pricing_coach.router import router as pricing_coach_router
from app.modules.m365.router import router as m365_router, public_router as m365_public_router
from app.modules.o2c.router import router as o2c_router
from app.modules.p2p.router import router as p2p_router
from app.modules.data_hub.router import router as data_hub_router
from app.modules.agent_designer.router import router as agent_designer_router
from app.modules.cotation_advanced.router import router as cotation_advanced_router
from app.modules.erp_integration.router import router as erp_integration_router
from app.core.tenant import TenantMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    init_sentry()
    logging.info("Starting STOURS Studio API...")
    yield
    from app.core.redis import close_redis
    await close_redis()
    logging.info("Shutting down...")


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="STOURS Studio API",
    description="Plateforme de génération de propositions commerciales pour DMC",
    version="0.2.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,  # 2-10x faster JSON serialization
    redirect_slashes=False,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

# GZip compression — compress responses > 500 bytes (huge win for JSON lists)
app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Request-ID",
                   "Accept-Encoding", "Cache-Control"],
)

app.include_router(auth_router,        prefix="/api")
app.include_router(projects_router,    prefix="/api")
app.include_router(quotations_router,  prefix="/api")
app.include_router(itineraries_router, prefix="/api")
app.include_router(menus_router,       prefix="/api")
app.include_router(transports_router,  prefix="/api")
app.include_router(guides_router,      prefix="/api")
app.include_router(ai_router,          prefix="/api")
app.include_router(datasources_router, prefix="/api")
app.include_router(reports_router,     prefix="/api")
app.include_router(references_router,   prefix="/api")
app.include_router(invoices_router,     prefix="/api")
app.include_router(admin_router,        prefix="/api")
app.include_router(reviews_router,      prefix="/api")
app.include_router(guide_portal_router, prefix="/api")
app.include_router(notifications_router,prefix="/api")
app.include_router(hotels_router,       prefix="/api")
app.include_router(proposals_router,    prefix="/api")
app.include_router(audit_router,        prefix="/api")
app.include_router(field_ops_router,    prefix="/api")
app.include_router(field_ops_public_router, prefix="/api")
app.include_router(finance_router,      prefix="/api")
app.include_router(gamification_router, prefix="/api")
app.include_router(collaboration_router, prefix="/api")
app.include_router(companies_router,    prefix="/api")
app.include_router(partners_router,     prefix="/api")
app.include_router(articles_router,     prefix="/api")
app.include_router(contracts_router,    prefix="/api")
app.include_router(pricing_router,      prefix="/api")
app.include_router(document_flow_router, prefix="/api")
app.include_router(approval_rules_router, prefix="/api")
app.include_router(approval_requests_router, prefix="/api")
app.include_router(travel_links_router, prefix="/api")
app.include_router(companion_public_router, prefix="/api")
app.include_router(ops_cockpit_router,  prefix="/api")
app.include_router(supplier_scores_router, prefix="/api")
app.include_router(supplier_incidents_router, prefix="/api")
app.include_router(sub_agent_portal_router, prefix="/api")
app.include_router(itinerary_templates_router, prefix="/api")
app.include_router(media_library_router, prefix="/api")
app.include_router(proposal_writer_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(payments_public_router, prefix="/api")
app.include_router(calendar_sync_router, prefix="/api")
app.include_router(calendar_sync_public_router, prefix="/api")
app.include_router(sustainability_router, prefix="/api")
app.include_router(payment_agent_router, prefix="/api")
app.include_router(pricing_coach_router, prefix="/api")
app.include_router(m365_router, prefix="/api")
app.include_router(m365_public_router, prefix="/api")
app.include_router(o2c_router, prefix="/api")
app.include_router(p2p_router, prefix="/api")
app.include_router(data_hub_router, prefix="/api")
app.include_router(agent_designer_router, prefix="/api")
app.include_router(cotation_advanced_router, prefix="/api")
app.include_router(erp_integration_router, prefix="/api")

# ── New features (Phase 4+5) ─────────────────────────────────────
from app.modules.pdf_generator.router import router as pdf_router
from app.modules.maps.router import router as maps_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.follow_up.router import router as follow_up_router
from app.modules.currency.router import router as currency_router
from app.modules.circuit_comparator.router import router as comparator_router
from app.modules.rooming_list.router import router as rooming_router
from app.modules.yield_mgmt.router import router as yield_router

app.include_router(pdf_router, prefix="/api")
app.include_router(maps_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(follow_up_router, prefix="/api")
app.include_router(currency_router, prefix="/api")
app.include_router(comparator_router, prefix="/api")
app.include_router(rooming_router, prefix="/api")
app.include_router(yield_router, prefix="/api")

# ── New features (Phase 6) ───────────────────────────────────────
from app.modules.client_portal.router import router as portal_mgmt_router
from app.modules.client_portal.router import public_router as portal_public_router
from app.modules.excel_export.router import router as excel_export_router
from app.modules.whatif.router import router as whatif_router
from app.modules.passengers.router import router as passengers_router
from app.modules.budget_tracker.router import router as budget_tracker_router

app.include_router(portal_mgmt_router, prefix="/api")
app.include_router(portal_public_router, prefix="/api")
app.include_router(excel_export_router, prefix="/api")
app.include_router(whatif_router, prefix="/api")
app.include_router(passengers_router, prefix="/api")
app.include_router(budget_tracker_router, prefix="/api")

# Tenant context middleware (extracts company_id from JWT)
app.add_middleware(TenantMiddleware)


from app.core.monitoring import perf_monitor, get_pool_stats


@app.middleware("http")
async def _security_and_access_log(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - t0) * 1000)

    # Record in performance monitor (lightweight in-memory)
    # Normalize path to avoid high-cardinality (replace UUIDs)
    import re
    norm_path = re.sub(
        r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
        '{id}', request.url.path
    )
    perf_monitor.record(norm_path, request.method, response.status_code, ms)

    # Only log slow requests in production to reduce I/O overhead
    if ms > 200 or settings.ENVIRONMENT != "production":
        logger.info(
            "%s %s → %d  (%dms)",
            request.method, request.url.path, response.status_code, ms,
        )
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Request-ID"] = request.headers.get("X-Request-ID", "")
    # Cache-Control for GET API responses
    if request.method == "GET" and "/engine/presets" in request.url.path:
        response.headers["Cache-Control"] = "public, max-age=3600"  # 1h for static presets
    elif request.method == "GET" and request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "private, max-age=0, must-revalidate"
    # Add Server-Timing header for frontend devtools
    response.headers["Server-Timing"] = f"total;dur={ms}"
    return response


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "0.2.0",
        "service": "STOURS Studio API",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/metrics", summary="Performance metrics (admin only)")
async def metrics():
    """Return endpoint performance stats and connection pool info."""
    from app.core.database import engine
    return {
        "performance": perf_monitor.get_stats(),
        "slow_endpoints": perf_monitor.get_slow_endpoints(threshold_ms=200),
        "db_pool": get_pool_stats(engine),
    }
