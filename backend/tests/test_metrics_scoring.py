"""Unit tests for the severity-weighted scoring shared by the dashboard's
headline score and the /api/v1/metrics/trend history — pure logic, no DB.
"""
from app.db.models import Severity
from app.services.metrics_service import weighted_score


def test_all_passing_scores_100():
    rows = [(Severity.CRITICAL, 3, 3), (Severity.LOW, 5, 5)]
    assert weighted_score(rows) == 100


def test_no_controls_evaluated_yet_scores_100_not_0():
    # An empty environment isn't "0% secure" — it's "nothing to be insecure
    # about yet". Scoring it 0 would make every fresh deployment look like
    # a five-alarm fire before a single scan has even run.
    assert weighted_score([]) == 100


def test_one_failing_critical_outweighs_many_passing_lows():
    # A single open CRITICAL (weight 5) against four passing LOWs (weight 1
    # each) should pull the score down hard, not get diluted into a "mostly
    # fine" number — this is the whole reason the score is weighted instead
    # of a flat pass rate.
    rows = [(Severity.CRITICAL, 1, 0), (Severity.LOW, 4, 4)]
    score = weighted_score(rows)
    assert score < 50


def test_matches_hand_computed_weighted_average():
    # 2 CRITICAL (weight 5) both failing, 2 LOW (weight 1) both passing:
    # weighted_total = 2*5 + 2*1 = 12, weighted_pass = 0 + 2*1 = 2
    # score = round(100 * 2 / 12) = 17
    rows = [(Severity.CRITICAL, 2, 0), (Severity.LOW, 2, 2)]
    assert weighted_score(rows) == 17
