"""
Estimation Engine — computes projected item counts, token usage, and
costs for generation operations WITHOUT calling the LLM.

Every generation endpoint that can produce more than a handful of items
has a paired /estimate endpoint (per rules.md Section 2). This module
provides the shared estimation math that powers all of them.

Design:
- Token estimates use reasonable per-item averages rather than computing
  exact prompt length, since the /estimate endpoint must be fast (no LLM
  calls, no database chunk content loading).
- All cost computation delegates to pricing.py — no duplicated math.
- The warning field triggers when item count exceeds a threshold.

Usage:
    estimate = estimate_question_generation(
        chunk_count=50,
        ga_pair_count=10,
        questions_per_combination=3,
        provider="openai",
        model="gpt-4o",
    )
    # Returns GenerationEstimateResponse with count=1500, tokens, cost
"""

from typing import Optional
from app.schemas import GenerationEstimateResponse
from app.core.pricing import estimate_cost_usd, estimate_token_cost

# ── Token estimation constants ───────────────────────────────────────
# These are conservative per-item estimates based on average prompt sizes.
# They deliberately overestimate rather than underestimate to avoid
# surprising users with higher-than-expected actual costs.

# Question generation: (input_tokens_per_item, output_tokens_per_item)
# Input includes: system prompt + chunk content + GA pair context
# Output is: the generated question text
TOKENS_PER_QUESTION = (2000, 100)    # (input, output) per question

# Answer generation: (input_tokens_per_item, output_tokens_per_item)
# Input includes: system prompt + chunk content + question
# Output is: the generated answer
TOKENS_PER_ANSWER = (2500, 500)      # (input, output) per answer

# Evaluation: (input_tokens_per_item, output_tokens_per_item)
# Input includes: system prompt + question + answer + context
# Output is: score + evaluation text
TOKENS_PER_EVALUATION = (3000, 300)  # (input, output) per evaluation

# Conversation: (input_tokens_per_item, output_tokens_per_item)
# Input includes: system prompt + scenario + context + turns
# Output is: the conversation
TOKENS_PER_CONVERSATION = (2000, 2000)  # (input, output) per conversation

# CoT synthesis: (input_tokens_per_item, output_tokens_per_item)
TOKENS_PER_COT = (3000, 500)        # (input, output) per CoT

# GA pair generation: (input_tokens_per_item, output_tokens_per_item)
# Input includes: system prompt + document content
# Output is: genre + audience titles
TOKENS_PER_GA_PAIR = (3000, 200)    # (input, output) per GA pair

# Warning threshold — if estimated items exceed this, include a warning
HIGH_VOLUME_THRESHOLD = 1000


def estimate_question_generation(
    chunk_count: int,
    ga_pair_count: int,
    questions_per_combination: int = 1,
    provider: str = "openai",
    model: str = "gpt-4o",
) -> GenerationEstimateResponse:
    """Estimate question generation cost.

    Question generation is combinatorial: N chunks × M GA pairs × Q questions.

    Args:
        chunk_count: Number of chunks to generate questions for.
        ga_pair_count: Number of Genre/Audience pairs to use.
        questions_per_combination: Questions per (chunk, GA pair) combo.
        provider: Provider name for cost estimation.
        model: Model name for cost estimation.

    Returns:
        GenerationEstimateResponse with projected counts and cost.
    """
    item_count = chunk_count * ga_pair_count * questions_per_combination
    input_per_item, output_per_item = TOKENS_PER_QUESTION
    total_input = item_count * input_per_item
    total_output = item_count * output_per_item

    cost = estimate_cost_usd(
        provider=provider,
        model=model,
        input_tokens=total_input,
        output_tokens=total_output,
    )

    warning = None
    if item_count > HIGH_VOLUME_THRESHOLD:
        warning = (
            f"This will generate approximately {item_count:,} items, "
            f"which exceeds the {HIGH_VOLUME_THRESHOLD:,}-item threshold. "
            f"Consider narrowing your selection."
        )

    return GenerationEstimateResponse(
        estimated_item_count=item_count,
        estimated_input_tokens=total_input,
        estimated_output_tokens=total_output,
        estimated_cost_usd=cost or 0.0,
        warning=warning,
    )


def estimate_answer_generation(
    question_count: int,
    provider: str = "openai",
    model: str = "gpt-4o",
) -> GenerationEstimateResponse:
    """Estimate answer generation cost.

    One answer per question. Simple N:1 mapping.

    Args:
        question_count: Number of questions to answer.
        provider: Provider name for cost estimation.
        model: Model name for cost estimation.

    Returns:
        GenerationEstimateResponse with projected counts and cost.
    """
    input_per_item, output_per_item = TOKENS_PER_ANSWER
    total_input = question_count * input_per_item
    total_output = question_count * output_per_item

    cost = estimate_cost_usd(
        provider=provider,
        model=model,
        input_tokens=total_input,
        output_tokens=total_output,
    )

    warning = None
    if question_count > HIGH_VOLUME_THRESHOLD:
        warning = (
            f"This will generate approximately {question_count:,} answers, "
            f"which exceeds the {HIGH_VOLUME_THRESHOLD:,}-item threshold. "
            f"Consider narrowing your selection."
        )

    return GenerationEstimateResponse(
        estimated_item_count=question_count,
        estimated_input_tokens=total_input,
        estimated_output_tokens=total_output,
        estimated_cost_usd=cost or 0.0,
        warning=warning,
    )


def estimate_evaluation(
    dataset_item_count: int,
    provider: str = "openai",
    model: str = "gpt-4o",
) -> GenerationEstimateResponse:
    """Estimate evaluation cost.

    One evaluation call per dataset item. Each call includes the question,
    answer, and context in the prompt.

    Args:
        dataset_item_count: Number of dataset items to evaluate.
        provider: Provider name for cost estimation.
        model: Model name for cost estimation.

    Returns:
        GenerationEstimateResponse with projected counts and cost.
    """
    input_per_item, output_per_item = TOKENS_PER_EVALUATION
    total_input = dataset_item_count * input_per_item
    total_output = dataset_item_count * output_per_item

    cost = estimate_cost_usd(
        provider=provider,
        model=model,
        input_tokens=total_input,
        output_tokens=total_output,
    )

    warning = None
    if dataset_item_count > HIGH_VOLUME_THRESHOLD:
        warning = (
            f"This will evaluate approximately {dataset_item_count:,} items, "
            f"which exceeds the {HIGH_VOLUME_THRESHOLD:,}-item threshold. "
            f"Consider narrowing your selection."
        )

    return GenerationEstimateResponse(
        estimated_item_count=dataset_item_count,
        estimated_input_tokens=total_input,
        estimated_output_tokens=total_output,
        estimated_cost_usd=cost or 0.0,
        warning=warning,
    )


def estimate_conversation_generation(
    question_count: int,
    turn_count: int = 4,
    provider: str = "openai",
    model: str = "gpt-4o",
) -> GenerationEstimateResponse:
    """Estimate conversation generation cost.

    Args:
        question_count: Number of conversations to generate.
        turn_count: Number of turns per conversation.
        provider: Provider name for cost estimation.
        model: Model name for cost estimation.

    Returns:
        GenerationEstimateResponse with projected counts and cost.
    """
    input_per_item, output_per_item = TOKENS_PER_CONVERSATION
    # Conversation output scales with turn count
    output_per_item = output_per_item * max(1, turn_count // 2)
    total_input = question_count * input_per_item
    total_output = question_count * output_per_item

    cost = estimate_cost_usd(
        provider=provider,
        model=model,
        input_tokens=total_input,
        output_tokens=total_output,
    )

    return GenerationEstimateResponse(
        estimated_item_count=question_count,
        estimated_input_tokens=total_input,
        estimated_output_tokens=total_output,
        estimated_cost_usd=cost or 0.0,
        warning=None,
    )


def estimate_cot_generation(
    dataset_item_count: int,
    provider: str = "openai",
    model: str = "gpt-4o",
) -> GenerationEstimateResponse:
    """Estimate chain-of-thought generation cost.

    Args:
        dataset_item_count: Number of items to synthesize CoT for.
        provider: Provider name for cost estimation.
        model: Model name for cost estimation.

    Returns:
        GenerationEstimateResponse with projected counts and cost.
    """
    input_per_item, output_per_item = TOKENS_PER_COT
    total_input = dataset_item_count * input_per_item
    total_output = dataset_item_count * output_per_item

    cost = estimate_cost_usd(
        provider=provider,
        model=model,
        input_tokens=total_input,
        output_tokens=total_output,
    )

    return GenerationEstimateResponse(
        estimated_item_count=dataset_item_count,
        estimated_input_tokens=total_input,
        estimated_output_tokens=total_output,
        estimated_cost_usd=cost or 0.0,
        warning=None,
    )


def estimate_ga_generation(
    document_count: int,
    provider: str = "openai",
    model: str = "gpt-4o",
) -> GenerationEstimateResponse:
    """Estimate GA pair generation cost.

    Args:
        document_count: Number of documents to generate GA pairs for.
        provider: Provider name for cost estimation.
        model: Model name for cost estimation.

    Returns:
        GenerationEstimateResponse with projected counts and cost.
    """
    input_per_item, output_per_item = TOKENS_PER_GA_PAIR
    total_input = document_count * input_per_item
    total_output = document_count * output_per_item

    cost = estimate_cost_usd(
        provider=provider,
        model=model,
        input_tokens=total_input,
        output_tokens=total_output,
    )

    return GenerationEstimateResponse(
        estimated_item_count=document_count,
        estimated_input_tokens=total_input,
        estimated_output_tokens=total_output,
        estimated_cost_usd=cost or 0.0,
        warning=None,
    )
