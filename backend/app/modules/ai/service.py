"""AI service — Business logic for AI integration with Anthropic Claude."""

import logging
import time
import asyncio
from uuid import UUID
from typing import TypeVar, Callable, Awaitable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.ai.models import AIRequest
from app.modules.ai.schemas import AIGenerateRequest, AIGenerateResponse

logger = logging.getLogger(__name__)

T = TypeVar("T")

async def _retry(
    fn: Callable[[], Awaitable[T]],
    max_attempts: int = 3,
    base_delay: float = 1.0,
    retryable_exceptions: tuple = (Exception,),
) -> T:
    """Retry async function with exponential backoff."""
    last_exc: Exception = RuntimeError("unreachable")
    for attempt in range(max_attempts):
        try:
            return await fn()
        except retryable_exceptions as exc:
            last_exc = exc
            if attempt == max_attempts - 1:
                break
            wait = base_delay * (2 ** attempt)
            logger.warning("AI attempt %d/%d failed (%s) — retry in %.1fs", attempt + 1, max_attempts, exc, wait)
            await asyncio.sleep(wait)
    raise last_exc


class AIService:
    """Handles AI content generation and transcription."""

    def __init__(self, db: Session):
        self.db = db

    async def generate_content(
        self,
        data: AIGenerateRequest,
        user_id: UUID | None = None,
    ) -> AIGenerateResponse:
        """Generate content using either Anthropic Claude or local Ollama."""
        start = time.monotonic()
        
        if data.provider == "ollama":
            return await self._generate_ollama(data, user_id, start)
        else:
            return await self._generate_anthropic(data, user_id, start)

    async def _generate_anthropic(self, data: AIGenerateRequest, user_id: UUID | None, start: float) -> AIGenerateResponse:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=30.0)
        try:
            def _call():
                return client.messages.create(
                    model=data.model,
                    max_tokens=data.max_tokens,
                    temperature=data.temperature,
                    messages=[{"role": "user", "content": data.prompt}],
                )
            # Retry jusqu'à 3 fois sur erreurs transitoires (rate limit, overload)
            import anthropic as _anth
            response = await _retry(
                lambda: asyncio.get_event_loop().run_in_executor(None, _call),
                max_attempts=3,
                base_delay=2.0,
                retryable_exceptions=(_anth.RateLimitError, _anth.InternalServerError, _anth.APIConnectionError),
            )
            duration_ms = int((time.monotonic() - start) * 1000)
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            content = response.content[0].text
            
            self._log_request(user_id=user_id, project_id=data.project_id, provider="anthropic",
                             model=data.model, request_type="generation", input_tokens=input_tokens,
                             output_tokens=output_tokens, duration_ms=duration_ms, status="success")
            return AIGenerateResponse(content=content, model=data.model, input_tokens=input_tokens,
                                      output_tokens=output_tokens, duration_ms=duration_ms)
        except Exception as e:
            self._log_error(user_id, data, "anthropic", start, e)
            raise

    async def _generate_ollama(self, data: AIGenerateRequest, user_id: UUID | None, start: float) -> AIGenerateResponse:
        import httpx
        # Default local Ollama URL. GEMMA:7B is the model requested by the user.
        ollama_url = "http://localhost:11434/api/generate"
        model_name = data.model if data.model != "claude-3-5-sonnet-20240620" else "gemma:7b"
        
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=60.0, write=10.0, pool=5.0)) as client:
                payload = {
                    "model": model_name,
                    "prompt": data.prompt,
                    "stream": False,
                    "options": {
                        "temperature": data.temperature,
                        "num_predict": data.max_tokens
                    }
                }
                response = await client.post(ollama_url, json=payload)
                response.raise_for_status()
                result = response.json()
                
                content = result.get("response", "")
                duration_ms = int((time.monotonic() - start) * 1000)
                
                # Ollama doesn't give precise tokens like Anthropic, we approximate or use their 'sample_count'
                input_tokens = len(data.prompt) // 4 
                output_tokens = len(content) // 4
                
                self._log_request(user_id=user_id, project_id=data.project_id, provider="ollama",
                                 model=model_name, request_type="generation", input_tokens=input_tokens,
                                 output_tokens=output_tokens, duration_ms=duration_ms, status="success")
                
                return AIGenerateResponse(content=content, model=model_name, input_tokens=input_tokens,
                                          output_tokens=output_tokens, duration_ms=duration_ms)
        except Exception as e:
            self._log_error(user_id, data, "ollama", start, e)
            raise

    def _log_error(self, user_id, data, provider, start, error):
        duration_ms = int((time.monotonic() - start) * 1000)
        self._log_request(
            user_id=user_id, project_id=data.project_id, provider=provider,
            model=data.model, request_type="generation", input_tokens=0,
            output_tokens=0, duration_ms=duration_ms, status="error",
            error_message=str(error)
        )

    def _log_request(self, **kwargs) -> None:
        """Log an AI request for auditing."""
        try:
            ai_request = AIRequest(**kwargs)
            self.db.add(ai_request)
            self.db.commit()
        except Exception as e:
            logger.error("Failed to log AI request: %s", e)
            self.db.rollback()

    async def extract_project_from_brief(self, brief: str, user_id: UUID | None = None) -> dict:
        """Extract project parameters from an informal brief (voice or text)."""
        prompt = f"""You are an expert travel consultant. Extract project data from this brief.
        
        Return ONLY a JSON object:
        {{
            "name": "Creative name for the project",
            "client_name": "Name of the client or agency if found",
            "project_type": "incentive|leisure|mice|fit|luxury",
            "destination": "Main destination cities or country",
            "duration_days": int,
            "pax_count": int,
            "notes": "Short summary of special requirements"
        }}
        
        BRIEF:
        \"\"\"
        {brief}
        \"\"\"
        """
        
        data = AIGenerateRequest(
            prompt=prompt,
            project_id=None,
            model="claude-3-5-sonnet-20240620",
            max_tokens=1000,
            temperature=0.0
        )
        
        response = await self._generate_anthropic(data, user_id, time.monotonic())
        content = response.content
        
        import json
        import re
        try:
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            return json.loads(content)
        except Exception as e:
            logger.error(f"Failed to parse AI project extraction: {e}")
            return {}

    async def suggest_optimal_pricing(
        self,
        project_id: str,
        db: Session,
        market: str = "FR"
    ) -> dict:
        """
        AI-driven predictive pricing. 
        Analyzes historical wins/losses to suggest optimal margin for the current project.
        """
        from app.modules.projects.models import Project
        from app.modules.quotations.models import Quotation

        # 1. Fetch current project details
        project = db.get(Project, project_id)
        if not project:
            return {"error": "Project not found"}

        # 2. Fetch some historical data (simplified for this version)
        historical = db.execute(
            select(Project.status, Project.pax_count, Project.destination)
            .where(Project.active == True, Project.status.in_(["won", "lost"]))
            .limit(20)
        ).all()

        history_str = "\n".join([
            f"- Dest: {h.destination}, Pax: {h.pax_count}, Status: {h.status}"
            for h in historical
        ])

        prompt = f"""
        Analyze current travel project and suggest optimal pricing strategy.
        Market: {market}
        Target Destination: {project.destination}
        Group Size: {project.pax_count} pax
        Type: {project.project_type}

        Historical data patterns:
        {history_str}

        Return JSON format:
        {{
            "optimal_margin_pct": 22,
            "confidence_score": 0.85,
            "market_insight": "Insight about current market demand for {market}",
            "suggested_price_adjustment": 5
        }}
        """
        
        try:
            from app.modules.ai.schemas import AIGenerateRequest
            req = AIGenerateRequest(prompt=prompt, provider="anthropic", max_tokens=512)
            response = await self.generate_content(req)
            import json, re
            match = re.search(r'\{.*\}', response.content, re.DOTALL)
            return json.loads(match.group(0)) if match else {"error": "Failed to parse AI response"}
        except Exception as e:
            logger.error(f"Predictive pricing failed: {e}")
            return {"error": str(e)}
