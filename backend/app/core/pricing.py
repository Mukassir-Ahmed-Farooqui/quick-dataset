"""
Pricing Engine — central registry for LLM model pricing.

Every pricing lookup goes through this module. No service computes its
own costs or hardcodes model prices — that guarantees a single source
of truth for cost estimation and usage tracking.

Design:
- Pricing is stored as (input_cost_per_1K, output_cost_per_1K) in USD.
- Models are keyed by their API model string (e.g. "gpt-4o").
- Unknown models fall back to a provider-level default.
- Provider-level unknown fallback to a flat default per 1K tokens.
- New models are added to the MODEL_PRICES dict — no code changes elsewhere.

Usage:
    cost = estimate_cost_usd("openai", "gpt-4o", input_tokens=500, output_tokens=200)
    # Returns 0.00350 (for 500 input + 200 output tokens at gpt-4o rates)
"""

from typing import Optional

# ── Type alias ───────────────────────────────────────────────────────

PriceEntry = tuple[float, float]  # (input_cost_per_1K_tokens, output_cost_per_1K_tokens)

# ── Provider-level fallbacks ─────────────────────────────────────────
# Used when a specific model isn't found in MODEL_PRICES.
# These are conservative averages — overestimate rather than underestimate.

PROVIDER_DEFAULTS: dict[str, PriceEntry] = {
    "openai":      (0.0050, 0.0150),   # ~gpt-4o-mini / gpt-4o midpoint
    "openrouter":  (0.0050, 0.0150),   # wide variance across proxied models
    "groq":        (0.0005, 0.0008),   # groq is generally very cheap
    "gemini":      (0.0015, 0.0020),   # gemini-pro / gemini-1.5 midpoint
}

FLAT_DEFAULT: PriceEntry = (0.0050, 0.0150)  # fallback for unknown providers

# ── Model-level pricing ──────────────────────────────────────────────
# (input_cost_per_1K_tokens, output_cost_per_1K_tokens) in USD

MODEL_PRICES: dict[str, PriceEntry] = {
    # ── OpenAI ──────────────────────────────────────────────────────
    "gpt-4o":                          (0.00250, 0.01000),
    "gpt-4o-2024-08-06":               (0.00250, 0.01000),
    "gpt-4o-mini":                     (0.00015, 0.00060),
    "gpt-4o-mini-2024-07-18":          (0.00015, 0.00060),
    "gpt-4-turbo":                     (0.01000, 0.03000),
    "gpt-4":                           (0.03000, 0.06000),
    "gpt-3.5-turbo":                   (0.00050, 0.00150),
    "o1-preview":                      (0.01500, 0.06000),
    "o1-mini":                         (0.00300, 0.01200),

    # ── OpenAI via OpenRouter ───────────────────────────────────────
    "openai/gpt-4o":                   (0.00250, 0.01000),
    "openai/gpt-4o-mini":              (0.00015, 0.00060),
    "openai/gpt-4-turbo":              (0.01000, 0.03000),
    "openai/o1-preview":               (0.01500, 0.06000),
    "openai/o1-mini":                  (0.00300, 0.01200),

    # ── Anthropic via OpenRouter ────────────────────────────────────
    "anthropic/claude-3.5-sonnet":     (0.00300, 0.01500),
    "anthropic/claude-3-opus":         (0.01500, 0.07500),
    "anthropic/claude-3-haiku":        (0.00025, 0.00125),

    # ── Google via OpenRouter ───────────────────────────────────────
    "google/gemini-pro":               (0.00125, 0.00500),
    "google/gemini-1.5-pro":           (0.00350, 0.01050),
    "google/gemini-1.5-flash":         (0.00035, 0.00105),

    # ── Meta via OpenRouter ─────────────────────────────────────────
    "meta-llama/llama-3-70b":          (0.00059, 0.00079),
    "meta-llama/llama-3-8b":           (0.00006, 0.00008),
    "meta-llama/llama-3.1-70b":        (0.00059, 0.00079),
    "meta-llama/llama-3.1-8b":         (0.00006, 0.00008),

    # ── Mistral via OpenRouter ──────────────────────────────────────
    "mistral/mistral-large":           (0.00200, 0.00600),
    "mistral/mistral-7b":              (0.00004, 0.00006),

    # ── Groq ────────────────────────────────────────────────────────
    "llama-3.1-70b-versatile":         (0.00059, 0.00079),
    "llama-3.1-8b-instant":            (0.00006, 0.00008),
    "mixtral-8x7b-32768":              (0.00024, 0.00024),
    "gemma2-9b-it":                    (0.00006, 0.00008),

    # ── Google Gemini (direct) ──────────────────────────────────────
    "gemini-pro":                      (0.00125, 0.00500),
    "gemini-1.5-pro":                  (0.00350, 0.01050),
    "gemini-1.5-flash":                (0.00035, 0.00105),
    "gemini-2.0-flash-exp":            (0.00035, 0.00105),
}


def get_model_pricing(provider: str, model: str) -> PriceEntry:
    """Look up pricing for a specific model.

    Resolution order:
    1. Exact match in MODEL_PRICES
    2. Provider-level default
    3. Flat fallback

    Returns (input_cost_per_1K, output_cost_per_1K) in USD.
    """
    # Try exact match first
    if model in MODEL_PRICES:
        return MODEL_PRICES[model]

    # Try provider-level default
    if provider in PROVIDER_DEFAULTS:
        return PROVIDER_DEFAULTS[provider]

    # Flat fallback
    return FLAT_DEFAULT


def estimate_cost_usd(
    provider: str,
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
) -> Optional[float]:
    """Estimate total cost in USD for a given token usage.

    Args:
        provider: Provider name (e.g. "openai", "groq").
        model: Model name (e.g. "gpt-4o", "llama-3.1-70b-versatile").
        input_tokens: Number of prompt/input tokens.
        output_tokens: Number of completion/output tokens.

    Returns:
        Estimated cost as a float in USD, or None if pricing is unknown
        and no fallback is configured (shouldn't happen in practice).
    """
    input_price, output_price = get_model_pricing(provider, model)

    total = (
        (input_tokens / 1000) * input_price
        + (output_tokens / 1000) * output_price
    )

    return round(total, 8)


def estimate_token_cost(
    provider: str,
    model: str,
    token_count: int,
    direction: str = "input",
) -> float:
    """Estimate cost for a single direction (input or output).

    Useful for preview/estimate endpoints that know the expected input
    size but not yet the output.

    Args:
        provider: Provider name.
        model: Model name.
        token_count: Number of tokens.
        direction: "input" or "output".

    Returns:
        Cost in USD.
    """
    input_price, output_price = get_model_pricing(provider, model)
    price = input_price if direction == "input" else output_price
    return round((token_count / 1000) * price, 8)
