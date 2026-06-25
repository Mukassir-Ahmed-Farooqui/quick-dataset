import time
import httpx
from typing import List, Dict
from app.services.llm.base import BaseLLMProvider
from app.schemas_extended import LLMResponse, ProviderTestResult


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.openai.com/v1"
        self.test_model = "gpt-4o-mini"

    async def complete(
        self, messages: List[Dict[str, str]], model: str,
        temperature: float = 0.7, max_tokens: int = 4096,
    ) -> LLMResponse:
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
            response = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers, timeout=60.0)
            response.raise_for_status()
            data = response.json()
            return LLMResponse(
                content=data["choices"][0]["message"]["content"],
                prompt_tokens=data.get("usage", {}).get("prompt_tokens", 0),
                completion_tokens=data.get("usage", {}).get("completion_tokens", 0),
                total_tokens=data.get("usage", {}).get("total_tokens", 0),
            )

    async def stream(self, messages: List[Dict[str, str]], model: str):
        raise NotImplementedError("Streaming not yet implemented")

    async def test_connection(self, model: str | None = None) -> ProviderTestResult:
        start_time = time.time()
        test_model = model or self.test_model
        try:
            await self.complete(messages=[{"role": "user", "content": "Ping"}], model=test_model, max_tokens=10)
            latency_ms = int((time.time() - start_time) * 1000)
            return ProviderTestResult(success=True, provider="openai", model=test_model, latency_ms=latency_ms)
        except httpx.HTTPStatusError as e:
            latency_ms = int((time.time() - start_time) * 1000)
            error_map = {
                401: "Invalid API key (401 Unauthorized)",
                402: "Insufficient credits (402 Payment Required)",
                429: "Rate limit exceeded (429 Too Many Requests)",
            }
            error_msg = error_map.get(e.response.status_code, f"HTTP {e.response.status_code}: {str(e)}")
            return ProviderTestResult(success=False, provider="openai", model=test_model, latency_ms=latency_ms, error=error_msg)
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return ProviderTestResult(success=False, provider="openai", model=test_model, latency_ms=latency_ms, error=str(e))
