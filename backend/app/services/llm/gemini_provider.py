import time
import httpx
from typing import List, Dict
from app.services.llm.base import BaseLLMProvider
from app.services.llm.http_client import get_http_client
from app.schemas_extended import LLMResponse, ProviderTestResult, ModelInfo
from app.services.llm import model_catalog


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.test_model = "gemini-2.0-flash"

    async def complete(
        self, messages: List[Dict[str, str]], model: str,
        temperature: float = 0.7, max_tokens: int = 4096,
    ) -> LLMResponse:
        client = get_http_client()
        contents = []
        system_instruction = None
        for m in messages:
            role = m["role"]
            if role == "system":
                system_instruction = {"parts": [{"text": m["content"]}]}
            elif role == "user":
                contents.append({"role": "user", "parts": [{"text": m["content"]}]})
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": m["content"]}]})

        body = {
            "contents": contents,
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
        }
        # Gemini 2.5 counts hidden thinking against maxOutputTokens; without a
        # cap a small max_tokens can be spent entirely on thinking and return
        # no text. Keep at least half the budget for the visible answer.
        if "2.5" in model:
            body["generationConfig"]["thinkingConfig"] = {"thinkingBudget": max(0, min(2048, max_tokens // 2))}
        if system_instruction:
            body["systemInstruction"] = system_instruction

        # Key in a header, never the URL: query strings end up in proxy and
        # access logs.
        url = f"{self.base_url}/models/{model}:generateContent"
        response = await client.post(url, json=body, headers={"x-goog-api-key": self.api_key})
        response.raise_for_status()
        data = response.json()

        candidates = data.get("candidates") or []
        parts = (candidates[0].get("content") or {}).get("parts") or [] if candidates else []
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        if not text.strip():
            reason = candidates[0].get("finishReason") if candidates else data.get("promptFeedback")
            raise ValueError(f"Gemini returned no text (finishReason={reason})")
        usage = data.get("usageMetadata", {})
        return LLMResponse(
            content=text,
            prompt_tokens=usage.get("promptTokenCount", 0),
            completion_tokens=usage.get("candidatesTokenCount", 0),
            total_tokens=usage.get("totalTokenCount", 0),
        )

    async def list_models(self) -> List[ModelInfo]:
        client = get_http_client()
        models: list[dict] = []
        page_token = None
        for _ in range(10):  # paginate defensively
            params = {"pageSize": 1000}
            if page_token:
                params["pageToken"] = page_token
            response = await client.get(
                f"{self.base_url}/models", params=params,
                headers={"x-goog-api-key": self.api_key},
            )
            response.raise_for_status()
            data = response.json()
            models.extend(data.get("models") or [])
            page_token = data.get("nextPageToken")
            if not page_token:
                break
        return model_catalog.parse_gemini({"models": models})

    async def stream(self, messages: List[Dict[str, str]], model: str):
        raise NotImplementedError("Streaming not yet implemented")

    async def test_connection(self, model: str | None = None) -> ProviderTestResult:
        start_time = time.time()
        test_model = model or self.test_model
        try:
            await self.complete(messages=[{"role": "user", "content": "Ping"}], model=test_model, max_tokens=10)
            latency_ms = int((time.time() - start_time) * 1000)
            return ProviderTestResult(success=True, provider="gemini", model=test_model, latency_ms=latency_ms)
        except httpx.HTTPStatusError as e:
            latency_ms = int((time.time() - start_time) * 1000)
            error_map = {
                400: "Invalid API key or request (400 Bad Request)",
                401: "Invalid API key (401 Unauthorized)",
                402: "Insufficient credits (402 Payment Required)",
                403: "Permission Denied (403 Forbidden)",
                429: "Rate limit exceeded (429 Too Many Requests)",
            }
            error_msg = error_map.get(e.response.status_code, f"HTTP {e.response.status_code}: {str(e)}")
            return ProviderTestResult(success=False, provider="gemini", model=test_model, latency_ms=latency_ms, error=error_msg)
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return ProviderTestResult(success=False, provider="gemini", model=test_model, latency_ms=latency_ms, error=str(e))
