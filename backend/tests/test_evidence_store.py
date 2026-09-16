"""Unit tests for the evidence hash-chain logic (pure functions, no I/O)."""
from app.evidence.store import GENESIS_HASH, _canonical_bytes, _content_hash


def test_canonical_bytes_is_key_order_independent():
    a = _canonical_bytes({"b": 2, "a": 1})
    b = _canonical_bytes({"a": 1, "b": 2})
    assert a == b


def test_content_hash_changes_when_payload_changes():
    h1 = _content_hash({"finding": "x"}, GENESIS_HASH)
    h2 = _content_hash({"finding": "y"}, GENESIS_HASH)
    assert h1 != h2


def test_content_hash_changes_when_prev_hash_changes():
    h1 = _content_hash({"finding": "x"}, GENESIS_HASH)
    h2 = _content_hash({"finding": "x"}, "a" * 64)
    assert h1 != h2


def test_content_hash_is_deterministic():
    h1 = _content_hash({"finding": "x", "n": 1}, GENESIS_HASH)
    h2 = _content_hash({"n": 1, "finding": "x"}, GENESIS_HASH)
    assert h1 == h2


def test_content_hash_is_64_char_hex():
    h = _content_hash({"a": 1}, GENESIS_HASH)
    assert len(h) == 64
    int(h, 16)  # raises if not valid hex
