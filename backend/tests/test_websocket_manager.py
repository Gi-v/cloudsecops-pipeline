"""Unit tests for ConnectionManager (app.websocket.live_feed) — pure logic
against mock WebSocket objects, no real socket or app needed. The
dead-connection cleanup in broadcast() (a send failing removes that client
rather than taking the whole broadcast down) had no coverage at all before
this: it's the one behavior here that isn't just "call the obvious method
and check the obvious result."
"""
from unittest.mock import AsyncMock

import pytest

from app.websocket.live_feed import ConnectionManager


def make_ws():
    ws = AsyncMock()
    return ws


@pytest.fixture
def manager():
    return ConnectionManager()


async def test_connect_accepts_and_tracks_the_socket(manager):
    ws = make_ws()
    await manager.connect(ws)
    ws.accept.assert_awaited_once()
    assert ws in manager._connections


def test_disconnect_removes_a_tracked_socket(manager):
    ws = make_ws()
    manager._connections.add(ws)
    manager.disconnect(ws)
    assert ws not in manager._connections


def test_disconnect_is_a_no_op_for_an_untracked_socket():
    """.discard(), not .remove() — disconnecting something never connected
    (or already cleaned up) must not raise."""
    manager = ConnectionManager()
    ws = make_ws()
    manager.disconnect(ws)  # must not raise
    assert ws not in manager._connections


async def test_broadcast_with_no_connections_sends_nothing(manager):
    await manager.broadcast({"type": "finding.enriched"})  # must not raise


async def test_broadcast_sends_the_same_payload_to_every_connection(manager):
    ws1, ws2 = make_ws(), make_ws()
    manager._connections = {ws1, ws2}

    await manager.broadcast({"type": "finding.enriched", "data": {"x": 1}})

    ws1.send_bytes.assert_awaited_once()
    ws2.send_bytes.assert_awaited_once()
    assert ws1.send_bytes.call_args.args[0] == ws2.send_bytes.call_args.args[0]


async def test_broadcast_drops_a_connection_whose_send_fails(manager):
    """A client that's gone stale (closed tab, dead connection) shouldn't
    take the rest of the broadcast down with it, and shouldn't stay
    tracked forever eating every future broadcast's time."""
    healthy = make_ws()
    dead = make_ws()
    dead.send_bytes.side_effect = ConnectionError("client gone")
    manager._connections = {healthy, dead}

    await manager.broadcast({"type": "finding.enriched"})

    healthy.send_bytes.assert_awaited_once()
    assert dead not in manager._connections
    assert healthy in manager._connections
