from app.services.generation.json_utils import extract_json, split_think


def test_plain_array():
    assert extract_json('["a", "b"]', expect=list) == ["a", "b"]


def test_fenced_with_prose_and_trailing_brackets():
    raw = 'Here you go:\n```json\n[{"q": "x"}]\n```\nHope this helps [1].'
    assert extract_json(raw, expect=list) == [{"q": "x"}]


def test_think_block_is_stripped_and_returned():
    raw = "<think>reasoning [not json]</think>\n[\"q1\"]"
    assert extract_json(raw, expect=list) == ["q1"]
    answer, think = split_think(raw)
    assert think == "reasoning [not json]"
    assert answer == '["q1"]'


def test_truncated_think_dropped():
    answer, think = split_think("prefix <think>never closed")
    assert answer == "prefix"
    assert think == "never closed"


def test_trailing_comma_and_smart_quotes():
    raw = "[\u201cWhat is X?\u201d, \u201cWhy Y?\u201d,]"
    assert extract_json(raw, expect=list) == ["What is X?", "Why Y?"]


def test_python_literal():
    assert extract_json("{'ok': True, 'v': None}", expect=dict) == {"ok": True, "v": None}


def test_brackets_inside_strings():
    raw = 'Result: ["use a[0] carefully", "then b]"] done'
    assert extract_json(raw, expect=list) == ["use a[0] carefully", "then b]"]


def test_unwrap_single_list_in_object():
    assert extract_json('{"questions": ["a", "b"]}', expect=list) == ["a", "b"]


def test_dict_from_single_item_list():
    assert extract_json('[{"score": 4}]', expect=dict) == {"score": 4}


def test_unterminated_fence():
    raw = '```json\n["a", "b"]'
    assert extract_json(raw, expect=list) == ["a", "b"]


def test_garbage_returns_none():
    assert extract_json("no json here", expect=list) is None
    assert extract_json("", expect=list) is None
    assert extract_json(None) is None


def test_apostrophe_in_word_does_not_break_scan():
    raw = "I don't know, but: [\"What's new?\"]"
    assert extract_json(raw, expect=list) == ["What's new?"]
