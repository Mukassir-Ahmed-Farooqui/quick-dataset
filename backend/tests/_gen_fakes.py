"""Fakes shared by the generator tests: an in-memory DB stand-in, task /
run / prompt stubs, and a fake ``tracked_complete`` that records
concurrency. No real database or LLM is touched."""
import asyncio
import os
from types import SimpleNamespace

os.environ.setdefault("ENCRYPTION_SECRET_KEY", "x2bJ0b4yJm0jzKxL0hV6m3c3pS0n9uQ2YkqB0V8t3aE=")

from app.models import Chunk, GAPair, Question  # noqa: E402
from app.schemas_extended import LLMResponse  # noqa: E402
from app.services.generation.resolver import ResolvedLLMConfig  # noqa: E402


class FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def filter(self, *a, **k):
        return self

    def order_by(self, *a, **k):
        return self

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None


class FakeDB:
    """Answers ``query(Model)`` with canned rows and records writes."""

    def __init__(self, chunks=(), pairs=(), existing_questions=()):
        self.chunks = list(chunks)
        self.pairs = list(pairs)
        self.existing_questions = list(existing_questions)  # (chunk_id, text)
        self.added = []
        self.commits = 0
        self.rollbacks = 0

    def query(self, *entities):
        first = entities[0]
        if first is Chunk:
            return FakeQuery(self.chunks)
        if first is GAPair:
            return FakeQuery(self.pairs)
        key = getattr(first, "key", None)
        cls = getattr(getattr(first, "class_", None), "__name__", None)
        if cls == "Question" and key == "chunk_id":
            return FakeQuery(self.existing_questions)
        if cls == "Chunk" and key == "content":
            return FakeQuery([(c.content,) for c in self.chunks])
        return FakeQuery([])

    def add(self, obj):
        self.added.append(obj)

    def add_all(self, objs):
        self.added.extend(objs)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def of_type(self, cls):
        return [o for o in self.added if isinstance(o, cls)]


class FakeTaskRepo:
    instances = []

    def __init__(self, db):
        self.task = SimpleNamespace(
            status="queued", completed_count=0, error_count=0, total_count=0,
            error_log=[], cancel_requested=False,
        )
        self.progress = 0
        self.completed = None
        self.failed = None
        FakeTaskRepo.instances.append(self)

    def get_task(self, task_id, project_id=None):
        return self.task

    def start_task(self, task_id):
        self.task.status = "processing"

    def update_progress(self, task_id, completed_increment=1, error_increment=0):
        self.progress += completed_increment

    def complete_task(self, task_id, completed_count=0, error_count=0, total_count=None):
        self.completed = dict(completed_count=completed_count, error_count=error_count, total_count=total_count)
        self.task.status = "done"

    def fail_task(self, task_id, error):
        self.failed = error


class FakeRunSvc:
    instances = []

    def __init__(self, db):
        self.run = SimpleNamespace(total_items=0)
        self.completed = None
        self.failed = None
        FakeRunSvc.instances.append(self)

    def start_run(self, run_id):
        return self.run

    def get_run(self, run_id):
        return self.run

    def complete_run(self, run_id, processed_items=0, total_items=0, **kw):
        self.completed = dict(processed_items=processed_items, total_items=total_items)

    def fail_run(self, run_id, error_message="", processed_items=0, **kw):
        self.failed = error_message


def make_prompt_service(template):
    class FakePromptService:
        def __init__(self, db):
            pass

        def get_active_prompt(self, project_id, prompt_type):
            return SimpleNamespace(content=template, version=1)

    return FakePromptService


def fake_resolve(db, project_id, user_id, model, **kw):
    return ResolvedLLMConfig(
        provider="openai", model=model, api_key="sk-test", llm_key_id="key-1",
        temperature=kw.get("temperature", 0.7), max_tokens=kw.get("max_tokens", 1024),
    )


class FakeLLM:
    """Async replacement for ``tracked_call.tracked_complete``.

    ``respond(prompt_text, call_index)`` returns the raw content string or
    raises. Tracks peak concurrency and appends a usage row to the sink.
    """

    def __init__(self, respond, delay=0.03):
        self.respond = respond
        self.delay = delay
        self.calls = 0
        self.prompts = []
        self.in_flight = 0
        self.peak = 0
        self.temperatures = []

    async def __call__(self, db, project_id, config, messages, model, *, temperature=0.7,
                       max_tokens=1024, task_id=None, usage_sink=None, timeout=None):
        self.calls += 1
        idx = self.calls
        prompt = messages[-1]["content"]
        self.prompts.append(prompt)
        self.temperatures.append(temperature)
        self.in_flight += 1
        self.peak = max(self.peak, self.in_flight)
        try:
            await asyncio.sleep(self.delay)
            content = self.respond(prompt, idx)
        finally:
            self.in_flight -= 1
            if usage_sink is not None:
                usage_sink.append({"project_id": project_id, "model": model})
        return LLMResponse(content=content, prompt_tokens=10, completion_tokens=5, total_tokens=15)


class AuthError(Exception):
    status_code = 401


def install_common(monkeypatch, module, template, llm):
    """Patch repos/services on a generator module and the LLM call."""
    from app.services.llm import tracked_call

    FakeTaskRepo.instances.clear()
    FakeRunSvc.instances.clear()
    flushed = []
    monkeypatch.setattr(module, "TaskRepository", FakeTaskRepo)
    monkeypatch.setattr(module, "GenerationRunService", FakeRunSvc)
    monkeypatch.setattr(module, "PromptService", make_prompt_service(template))
    monkeypatch.setattr(module, "resolve_llm_config_with_model", fake_resolve)
    monkeypatch.setattr(tracked_call, "tracked_complete", llm)
    monkeypatch.setattr(
        tracked_call, "flush_usage_logs",
        lambda db, entries: (flushed.extend(entries), entries.clear(), len(flushed))[-1],
    )
    return flushed
