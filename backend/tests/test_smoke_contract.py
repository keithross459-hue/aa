"""Source-level smoke contracts for launch-critical routes.

This stays lightweight so it can run in environments that have not installed
the full AI integration stack yet.
"""
from pathlib import Path


def test_launch_critical_routes_registered():
    root = Path(__file__).resolve().parents[1]
    source = "\n".join([
        (root / "server.py").read_text(),
        (root / "routers" / "billing.py").read_text(),
        (root / "routers" / "referrals.py").read_text(),
        (root / "routers" / "admin.py").read_text(),
        (root / "routers" / "analytics.py").read_text(),
        (root / "routers" / "machine.py").read_text(),
    ])
    expected = {
        '"/health"',
        '"/ready"',
        '"/status"',
        '"/invoices"',
        '"/payment-methods"',
        '"/ledger"',
        '"/payouts"',
        '"/executive"',
        '"/run"',
        '"/legal/privacy"',
        '"/legal/terms"',
    }
    missing = [path for path in expected if path not in source]
    assert not missing
