import time
import httpx
from typing import List, Dict
from app.services.llm.base import BaseLLMProvider
from app.schemas_extended import LLMResponse, ProviderTestResult


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.test_model = "gemini-2.0-flash"

    async def complete(
        self, messages: List[Dict[str, str]], model: str,
        temperature: float = 0.7, max_tokens: int = 4096,
    ) -> LLMResponse:
        async with httpx.AsyncClient() as client:
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
            if system_instruction:
                body["systemInstruction"] = system_instruction

            url = f"{self.base_url}/models/{model}:generateContent?key={self.api_key}"
            response = await client.post(url, json=body, timeout=60.0)
            response.raise_for_status()
            data = response.json()

            text = data["candidates"][0]["content"]["parts"][0]["text"]
            usage = data.get("usageMetadata", {})
            return LLMResponse(
                content=text,
                prompt_tokens=usage.get("promptTokenCount", 0),
                completion_tokens=usage.get("candidatesTokenCount", 0),
                total_tokens=usage.get("totalTokenCount", 0),
            )

    async def stream(self, messages: List[Dict[str, str]], model: str):
        raise NotImplementedError("Streaming not yet implemented")

    async def test_connection(self, model: str | None = None) -> ProviderTestResult:
        start_time = time.time()
        test_model = model or self.test_model
        try:
            await self.complete(messages=[{"role": "user", "content": "Ping"}], model=test_model, max_tokens=10)
            latency_ms = int((time.time() - start_time) * 1000)
            return ProviderTestResult(success=True, provider="gemini", model=test_model, latency_ms=latency_ms)
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return ProviderTestResult(success=False, provider="gemini", model=test_model, latency_ms=latency_ms, error=str(e))
