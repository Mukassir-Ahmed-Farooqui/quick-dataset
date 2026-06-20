from app.services.llm.base import BaseLLMProvider
from app.services.llm.openrouter import OpenRouterProvider
from app.services.llm.openai_provider import OpenAIProvider
from app.services.llm.groq_provider import GroqProvider
from app.services.llm.gemini_provider import GeminiProvider
from app.models import LLMProvider


class ProviderFactory:

    _registry = {
        "openrouter": OpenRouterProvider,
        "openai": OpenAIProvider,
        "groq": GroqProvider,
        "gemini": GeminiProvider,
    }

    @staticmethod
    def create(provider: LLMProvider | str, api_key: str) -> BaseLLMProvider:
        name = provider.value if isinstance(provider, LLMProvider) else provider
        cls = ProviderFactory._registry.get(name)
        if cls is None:
            raise ValueError(f"Unsupported provider: {name}")
        return cls(api_key=api_key)
