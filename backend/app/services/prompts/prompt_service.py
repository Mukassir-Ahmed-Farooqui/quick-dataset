"""
Prompt Versioning Service — append-only prompt management.

Rules (from rules.md Section 2):
- Prompts are append-only. upsert_prompt() always inserts a new
  custom_prompts row and demotes the previous one (is_active = false),
  never updates content in place.
- generation_runs.prompt_version points to a specific version that
  never changes — this is what makes the pointer permanent.

System defaults:
- When no custom prompt exists for a (project, prompt_type), the service
  returns a system default prompt (is_system_default=True, version=0).
- System defaults are defined per prompt_type and provide the base
  templates that ship with the application.
"""

import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import CustomPrompt, PromptType
from app.schemas_extended import PromptOut, PromptUpsertRequest

logger = logging.getLogger(__name__)

# ── System default prompts ──────────────────────────────────────────
# These ship with the application and serve as the base templates when
# no project-level override exists. They are not stored in the database.

#
# Placeholders are plain ``{name}`` tokens substituted by
# ``app.services.generation.context.render_prompt`` (known keys only, so
# JSON braces in the examples below are safe). Ported from Easy Dataset's
# English prompts (lib/llm/prompts/*.js) and tightened.
#
#   ga:            {content} {pairs_per_document}
#   question:      {content} {text_length} {questions_per_combination} (alias {number})
#                  {ga_prompt} {ga_prompt_note} {ga_prompt_check} {genre} {audience}
#   answer:        {content} {question} {ga_prompt} {output_format}
#   evaluation:    {content} {question} {answer}
#   cot_synthesis: {content} {question} {answer}
#   cot_optimization: {content} {question} {answer} {cot}

GA_PROMPT = """# Role: Genre & Audience Design Specialist
## Profile:
- Description: You are an expert in content analysis and creative abstraction. You design diverse, high-quality [Genre]-[Audience] pairings grounded in a source document, which downstream systems use to vary question style and adapt answers.
- Output Goal: Produce exactly {pairs_per_document} distinctive [Genre]-[Audience] pairs with clear differentiation.

## Skills:
1. Derive deep insight into the topic, structure, tone, information density, and potential value of the source document.
2. Command a wide range of questioning genres: factual recall, conceptual understanding, analytical / root-cause reasoning, comparison, evaluation, procedural / how-to guidance, troubleshooting, application to scenarios.
3. Portray audiences across age, expertise, motivation, and engagement levels, ensuring multi-perspective coverage.
4. Communicate precisely so the output can be consumed programmatically.

## Workflow:
1. **Document Insight**: Read the whole input. If it is a digest (outline plus excerpts), treat the outline as the map of the full document and the excerpts as samples from across it; design pairs that fit the WHOLE document, not just the first excerpt.
2. **Scenario Ideation**: Imagine realistic learning or inquiry scenarios in which someone would ask questions about this material.
3. **Pair Construction**: For each scenario, write a genre and a matching audience with an explicit logical connection between them.
4. **Redundancy Check**: Ensure all pairs differ in genre style, tone, depth, and audience profile; no repetitions or near-duplicates.

## Constraints:
1. Each genre has a short "title" (2-6 words) and a "description" of 2-3 sentences describing the questioning style, focus, depth, and tone. Exclude visual formats (comics, video, infographics).
2. Each audience has a short "title" (2-8 words) and a "description" of exactly 2 sentences: background and knowledge level, then motivation and desired outcome. Include both highly engaged and more casual audiences across the set.
3. Genre and audience within a pair must fit together naturally and must be plausible for THIS document's subject matter.
4. Do not invent topics unrelated to the document; do not reuse generic templates verbatim.
5. Return exactly {pairs_per_document} pairs and nothing else: no commentary, no markdown outside the JSON.

## Output Format:
Return a valid JSON array of length {pairs_per_document}. Every element has "genre" and "audience" objects, each with "title" and "description" string fields. Use double quotes.
```json
[
  {
    "genre": {"title": "Root Cause Analysis", "description": "Probes why and how things happen, tracing mechanisms and causal chains. Questions demand explanations of underlying principles rather than surface facts."},
    "audience": {"title": "Junior Engineers Learning the System", "description": "Early-career engineers with basic technical literacy but limited domain experience. They want to understand the reasoning behind design decisions so they can apply it on the job."}
  }
]
```

## Source Document:
{content}
"""

QUESTION_PROMPT = """# Role: Text Question Generation Expert
## Profile:
- Description: You are an expert in text analysis and question design. You extract key information from passages and produce high-quality questions for building question-answer fine-tuning datasets.
- Input Length: {text_length} characters
- Output Goal: Generate exactly {questions_per_combination} high-quality question(s).

## Skills:
1. Comprehend the passage thoroughly and identify core concepts, facts, figures, procedures, causal relations, and conclusions.
2. Design questions with a clear, single answer orientation that cover different aspects of the passage.
3. Balance difficulty and variety (what / why / how / compare / apply) for representative coverage.
4. Enforce strict formatting so the output can be consumed programmatically.

## Workflow:
1. **Text Parsing**: Read the entire passage (the "Source document:" and "Section:" lines, if present, only tell you where the passage comes from) and note key entities, events, metrics, definitions, steps, and conclusions.
2. **Question Design**: Select the most informative focal points and craft questions{ga_prompt_note}.
3. **Quality Check**: Validate every question:
   - Its answer can be found in, or directly derived from, the passage alone.
   - It is self-contained: a reader who has not seen the passage understands what is being asked (name the specific subject instead of "it", "this method", "the above").
   - No two questions share the same topic and angle.
   - Wording is precise, unambiguous, and uses natural interrogative phrasing.
   {ga_prompt_check}

## Constraints:
1. Every question must be grounded strictly in the passage; no outside knowledge, speculation, or hypothetical scenarios whose answers are not in the text.
2. Cover different themes, layers, or perspectives of the passage; do not cluster on a single sentence.
3. Never ask about meta information: author, title, chapters, sections, headings, page numbers, table of contents, or document structure.
4. Never use phrases such as "according to the text/article/passage/document/report", "in this passage", or "the author says"; questions must read naturally on their own.
5. Do not ask yes/no questions or questions whose answer is a single trivial word unless the fact is genuinely important.
6. Output exactly {questions_per_combination} question(s), each a single sentence ending with a question mark.
7. Never ask bibliographic or administrative trivia: URLs, DOIs, errata, revision history, publication dates, figure or table numbers, appendix names, acknowledgments, reference lists, or contact details.
8. Questions are used to fine-tune a model that will NOT see this passage. Never refer to "the guide", "the guideline", "the publication", "the report", "the recommendation", or a bare label such as "R3" or "N1". When the subject belongs to a named framework, standard, product, or document (see "Source document:"), name it explicitly.
9. If the passage is boilerplate with nothing worth learning (a table of contents, index, reference list, running headers, legal notice, or a near-empty page), return an empty array [] instead of inventing questions.

## Output Format:
Return ONLY a valid JSON array of strings, double-quoted, with no commentary (or [] when rule 9 applies):
```json
["Question 1?", "Question 2?"]
```

## Output Example:
```json
["What core elements should an AI ethics framework include?", "How does the Civil Code change the rules for protecting personal data?"]
```

## Text to Analyze:
{content}

{ga_prompt}
"""

ANSWER_PROMPT = """# Role: Fine-tuning Dataset Answer Expert
## Profile:
- Description: You write accurate, well-grounded answers to questions using only the reference content provided, producing answers suitable for training large language models.

## Skills:
1. Locate every piece of information in the reference content that bears on the question.
2. Synthesize it into a complete, logically ordered answer in natural, fluent language.
3. Refuse to fabricate: facts, figures, names, and steps come only from the reference content.

{ga_prompt}

## Workflow:
1. Read the question and identify exactly what it asks for.
2. Find all relevant facts in the reference content.
3. Compose an answer that directly addresses the question, covering every relevant point and nothing irrelevant.
4. Verify every claim in your answer against the reference content; remove anything not supported by it.

## Reference Content:
------ Reference Content Start ------
{content}
------ Reference Content End ------

## Question:
{question}

## Constraints:
1. The answer must be based strictly on the reference content. Do not add outside knowledge, opinions, or assumptions.
2. If the reference content only partially answers the question, answer what it supports and state briefly which part it does not cover. Never invent the missing part.
3. Be comprehensive and detailed enough to fully answer the question, but do not pad with repetition.
4. Never use referential phrases such as "according to the reference", "the text states", "this entry notes", "based on the document", or citation marks; present the information directly. The answer will train a model that never sees the reference, so it must stand on its own.
5. Begin with the direct answer, then give supporting detail, steps, or explanation where useful.
6. Do not add purposes, consequences, or explanations the reference does not state, even if they seem obvious.
{output_format}
"""

EVALUATION_PROMPT = """# Role: Dataset Quality Evaluation Expert
## Profile:
- Description: You are a strict evaluator of question-answer training data. You judge each sample on multiple dimensions and give a calibrated score used to filter data for fine-tuning.

## Evaluation Dimensions:
### 1. Question Quality (25%)
- 5: Clear, precise, self-contained, grammatical, appropriate difficulty.
- 3: Understandable but somewhat ambiguous, vague, or reliant on unseen context.
- 1: Seriously unclear, meta (about the document itself), or unanswerable.
- 0: Incomprehensible.

### 2. Answer Quality (35%)
- 5: Completely accurate, complete, logically structured, directly addresses the question.
- 3: Generally correct but missing details or with weak structure.
- 1: Mostly wrong or off-topic.
- 0: Completely wrong or irrelevant.

### 3. Grounding in the Source Text (25%)
- 5: Every claim in the answer is supported by the source text; nothing is fabricated.
- 3: Mostly supported, with minor unsupported additions.
- 1: Largely unsupported by or contradicting the source text.
- 0: Unrelated to the source text.
If no source text is given, judge internal consistency and factual plausibility instead.

### 4. Overall Consistency & Training Value (15%)
- 5: Question, answer, and source form a coherent whole; ideal for training.
- 3: Usable after slight adjustment.
- 1: Not suitable for training without major changes.

## Source Text:
{content}

## Question:
{question}

## Answer:
{answer}

## Rules:
1. Final score = Question×0.25 + Answer×0.35 + Grounding×0.25 + Consistency×0.15, on a 0-5 scale, rounded to the nearest 0.5.
2. Be strict: 5 means near-perfect. Any factual error, fabrication, or a meta/unanswerable question must score below 2.
3. The data trains a model that will NOT see the source. Score Training Value low (≤2) and cap the final score at 2.5 when:
   - the question is document trivia: page, figure, table or appendix numbers, section titles, table of contents, errata, revision history, URLs, DOIs, publication dates, authors, or acknowledgments;
   - the question depends on unseen context ("the guide", "the recommendation", "R3", "the worm", "the server") instead of naming its subject;
   - the answer refers to the source ("the text explains", "this entry notes", "the document states").
4. Check rule 3 before anything else. A bare code (R1, PR.AA, RS.MI-01) or a vague reference ("the specified requirements", "this section") that a reader without the source cannot decode counts as unseen context. A question whose only purpose is to recall a code's label, an email address, or a name is document trivia.
5. Reserve 5 for samples with no flaw at all. If you can name any weakness, the score is at most 4.5.
4. Lower Grounding to 3 when the answer adds explanations, consequences, or purposes the source does not state, even if plausible.
5. Most real samples are not perfect. Give 5 only when you can name no weakness at all.
6. Keep the evaluation under 80 words, naming the main strength and the main weakness.

## Output Format:
Return ONLY a JSON object, no markdown, no other text:
{"score": 4.5, "evaluation": "Clear, specific question; the answer is accurate and fully supported by the source, but omits one minor detail."}
"""

COT_SYNTHESIS_PROMPT = """# Role: Chain-of-Thought Reconstruction Expert
## Profile:
- Description: Given a question, reference content, and the final answer, you reconstruct the reasoning path an expert would follow from the question to that answer, written as a natural internal monologue.

## Workflow:
1. Understand what the question really asks and what type it is (factual, causal, comparative, procedural, ...).
2. Break the answer into its key components and identify the evidence each one rests on.
3. Connect the evidence in a natural order (known to unknown, surface to depth), each step building on the previous one.
4. Check that the reasoning converges exactly on the given answer, with no gaps or extra conclusions.

## Question:
{question}

## Reference Content:
------ Reference Content Start ------
{content}
------ Reference Content End ------

## Answer:
{answer}

## Constraints:
1. Every step must follow logically from the previous ones; no unsupported leaps.
2. Never use citation phrases such as "according to the reference", "the document mentions", or "based on the source"; present information as reasoning.
3. Progress naturally: first analyse the problem, then gather the key conditions, derive step by step, and finally conclude.
4. The conclusion must match the given answer exactly: introduce nothing new and omit nothing essential.
5. 3-5 steps for simple questions, 5-8 for complex ones. Write in flowing prose, not numbered lists.
6. Output only the chain of thought itself, with no title or preface.
"""

COT_OPTIMIZATION_PROMPT = """# Role: Chain-of-Thought Optimization Expert
## Profile:
- Description: You clean up a chain of thought: remove citation and reference phrases and present it as a coherent, natural reasoning process.

## Workflow:
1. Study the question, the answer, and the original chain of thought.
2. Remove every reference or citation expression ("the document mentions", "according to the material", "the reference content says", ...), rewriting sentences so they still flow.
3. Make sure the optimized reasoning still leads to the answer and stays tied to the question.

## Reference Content:
{content}

## Question:
{question}

## Answer:
{answer}

## Original Chain of Thought:
{cot}

## Constraints:
1. Remove all reference and citation phrases.
2. Keep the reasoning complete, logical, and consistent with the answer.
3. Use a natural progression (first, then, next, finally) without numbered lists.
4. Output only the optimized chain of thought, with no title or preface such as "Optimized chain of thought:".
"""

SYSTEM_PROMPTS: dict[PromptType, str] = {
    PromptType.ga: GA_PROMPT,
    PromptType.question: QUESTION_PROMPT,
    PromptType.answer: ANSWER_PROMPT,
    PromptType.evaluation: EVALUATION_PROMPT,
    PromptType.conversation: (
        "You are a conversation generation expert. Create a conversation with "
        "{turn_count} turns between {role_a} and {role_b} based on the following "
        "context and question.\n\n"
        "Scenario: {scenario}\n\n"
        "Context:\n{content}\n\n"
        "Question:\n{question}\n\n"
        "Generate a natural, realistic conversation that explores the topic. "
        "Every factual statement must be supported by the context."
    ),
    PromptType.cot_synthesis: COT_SYNTHESIS_PROMPT,
    PromptType.cot_optimization: COT_OPTIMIZATION_PROMPT,
}


class PromptService:
    """Manages prompt versioning lifecycle."""

    def __init__(self, db: Session):
        self.db = db

    def get_active_prompt(
        self,
        project_id: str,
        prompt_type: PromptType,
    ) -> PromptOut:
        """Get the active prompt for a (project, prompt_type).

        Returns a PromptOut. If no project-level override exists, returns
        the system default with version=0 and is_system_default=True.

        Args:
            project_id: Project scope.
            prompt_type: Which prompt type to retrieve.

        Returns:
            PromptOut with content, version, and is_system_default flag.
        """
        # 1. Look for active project-level override
        active = (
            self.db.query(CustomPrompt)
            .filter(
                CustomPrompt.project_id == project_id,
                CustomPrompt.prompt_type == prompt_type,
                CustomPrompt.is_active == True,
            )
            .first()
        )

        if active:
            return PromptOut(
                prompt_type=active.prompt_type.value,
                content=active.content,
                version=active.version,
                is_system_default=False,
                created_at=active.created_at,
            )

        # 2. Return system default
        system_content = SYSTEM_PROMPTS.get(prompt_type, "")
        return PromptOut(
            prompt_type=prompt_type.value,
            content=system_content,
            version=0,
            is_system_default=True,
            created_at=None,
        )

    def upsert_prompt(
        self,
        project_id: str,
        prompt_type: PromptType,
        request: PromptUpsertRequest,
    ) -> PromptOut:
        """Create a new version of a prompt.

        Always inserts a new row with version + 1 and demotes the
        previous active version. Never updates content in place.

        Args:
            project_id: Project scope.
            prompt_type: Which prompt type to update.
            request: New content.

        Returns:
            PromptOut for the newly created version.
        """
        # 1. Get current max version
        max_version = (
            self.db.query(func.max(CustomPrompt.version))
            .filter(
                CustomPrompt.project_id == project_id,
                CustomPrompt.prompt_type == prompt_type,
            )
            .scalar()
        ) or 0

        # 2. Demote previous active version
        self.db.query(CustomPrompt).filter(
            CustomPrompt.project_id == project_id,
            CustomPrompt.prompt_type == prompt_type,
            CustomPrompt.is_active == True,
        ).update({"is_active": False})

        # 3. Create new version
        new_version = max_version + 1
        prompt = CustomPrompt(
            project_id=project_id,
            prompt_type=prompt_type,
            content=request.content,
            version=new_version,
            is_active=True,
        )
        self.db.add(prompt)
        self.db.commit()
        self.db.refresh(prompt)

        logger.info(
            "Prompt upserted | project=%s type=%s version=%d",
            project_id, prompt_type.value, new_version,
        )

        return PromptOut(
            prompt_type=prompt.prompt_type.value,
            content=prompt.content,
            version=prompt.version,
            is_system_default=False,
            created_at=prompt.created_at,
        )

    def get_prompt_version(
        self,
        project_id: str,
        prompt_type: PromptType,
        version: int,
    ) -> Optional[PromptOut]:
        """Get a specific version of a prompt.

        Args:
            project_id: Project scope.
            prompt_type: Which prompt type.
            version: Which version to retrieve (0 = system default).

        Returns:
            PromptOut or None if version not found.
        """
        if version == 0:
            system_content = SYSTEM_PROMPTS.get(prompt_type, "")
            return PromptOut(
                prompt_type=prompt_type.value,
                content=system_content,
                version=0,
                is_system_default=True,
                created_at=None,
            )

        prompt = (
            self.db.query(CustomPrompt)
            .filter(
                CustomPrompt.project_id == project_id,
                CustomPrompt.prompt_type == prompt_type,
                CustomPrompt.version == version,
            )
            .first()
        )

        if not prompt:
            return None

        return PromptOut(
            prompt_type=prompt.prompt_type.value,
            content=prompt.content,
            version=prompt.version,
            is_system_default=False,
            created_at=prompt.created_at,
        )

    def list_prompt_versions(
        self,
        project_id: str,
        prompt_type: PromptType,
    ) -> list[PromptOut]:
        """List all versions of a prompt type for a project.

        The system default (version 0) is always included as the first
        entry if it exists, followed by project overrides in descending
        version order.

        Args:
            project_id: Project scope.
            prompt_type: Which prompt type.

        Returns:
            List of PromptOut, newest version first.
        """
        results: list[PromptOut] = []

        # System default (version 0)
        system_content = SYSTEM_PROMPTS.get(prompt_type, "")
        results.append(PromptOut(
            prompt_type=prompt_type.value,
            content=system_content,
            version=0,
            is_system_default=True,
            created_at=None,
        ))

        # Project overrides
        overrides = (
            self.db.query(CustomPrompt)
            .filter(
                CustomPrompt.project_id == project_id,
                CustomPrompt.prompt_type == prompt_type,
            )
            .order_by(CustomPrompt.version.desc())
            .all()
        )

        results.extend(
            PromptOut(
                prompt_type=p.prompt_type.value,
                content=p.content,
                version=p.version,
                is_system_default=False,
                created_at=p.created_at,
            )
            for p in overrides
        )

        return results

    def get_system_default(self, prompt_type: PromptType) -> str:
        """Get the raw system default prompt text for a prompt type.

        Used for rendering in the playground without needing a project
        context.
        """
        return SYSTEM_PROMPTS.get(prompt_type, "")
