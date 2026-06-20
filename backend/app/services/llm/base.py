from abc import ABC, abstractmethod
from typing import List, Dict
from app.schemas_extended import LLMResponse, ProviderTestResult

class BaseLLMProvider(ABC):

    @abstractmethod
    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> LLMResponse:
        pass

    @abstractmethod
    async def stream(
        self,
        messages: List[Dict[str, str]],
        model: str
    ):
        pass

    @abstractmethod
    async def test_connection(self, model: str | None = None) -> ProviderTestResult:
        pass
