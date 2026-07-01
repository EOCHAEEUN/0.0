from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.agents import chat_orchestrator as orch  # noqa: E402
from app.agents.equipment_safety import build_safety_snapshot  # noqa: E402
from app.agents.response import response_node  # noqa: E402
from app.main import app  # noqa: E402
from app.services import advisor_chat_service as svc  # noqa: E402


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, db, table_name: str):
        self.db = db
        self.table_name = table_name
        self.filters = {}
        self._limit = None
        self._order = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def limit(self, value):
        self._limit = value
        return self

    def order(self, key, desc=False):
        self._order = (key, desc)
        return self

    def update(self, payload):
        self.db.write_calls.append(("update", self.table_name, payload))
        return self

    def insert(self, payload):
        self.db.write_calls.append(("insert", self.table_name, payload))
        return self

    def upsert(self, payload, on_conflict=None):
        self.db.write_calls.append(("upsert", self.table_name, payload, on_conflict))
        return self

    def execute(self):
        rows = list(self.db.tables.get(self.table_name, []))
        for key, value in self.filters.items():
            rows = [row for row in rows if str(row.get(key, "")) == str(value)]
        if self._order:
            key, desc = self._order
            rows = sorted(rows, key=lambda item: item.get(key) or "", reverse=desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return FakeResult(rows)


class FakeDB:
    def __init__(self, tables):
        self.tables = tables
        self.write_calls = []

    def table(self, name: str):
        return FakeQuery(self, name)


def _fixtures():
    roi_data = {
        "scenario_a": {
            "investment_manwon": 10000,
            "net_investment_manwon": 7000,
            "roi_pct": 22.5,
            "payback_years": 2.8,
            "annual_net_benefit_manwon": 2500,
        },
        "scenario_b": {
            "investment_manwon": 7000,
            "net_investment_manwon": 5000,
            "roi_pct": 18.0,
            "payback_years": 3.2,
            "annual_net_benefit_manwon": 1600,
        },
        "recommended": "A",
        "policy_applications": {
            "scenario_a": {"applied_support_manwon": 3000},
            "scenario_b": {"applied_support_manwon": 2000},
        },
    }
    policy_snapshot = {
        "snapshot_version": "1",
        "recommended_policy_id": "p1",
        "policies": [
            {
                "policy_id": "p1",
                "title": "스마트공장 고도화",
                "deadline_display": "2026-08-31",
                "d_day": "D-60",
                "max_amount_actual": "5,000만원",
            }
        ],
    }
    return {
        "company": [{"company_id": "c1", "company_name": "Facto", "user_id": "u1"}],
        "equipment": [
            {
                "company_id": "c1",
                "equipment_id": "e1",
                "name": "프레스",
                "category": "press",
                "age_years": 12,
                "energy_cost_annual": 3000,
                "maintenance_cost_annual": 500,
                "scenario_a_investment_manwon": 10000,
                "scenario_b_investment_manwon": 7000,
            }
        ],
        "roi_output": [
            {
                "id": "a1",
                "company_id": "c1",
                "equipment_id": "e1",
                "roi_data": roi_data,
                "policy_snapshot": policy_snapshot,
            }
        ],
        "draft_result": [
            {
                "company_id": "c1",
                "analysis_id": "a1",
                "policy_id": "p1",
                "draft_content": "신청서 초안 본문",
                "created_at": "2026-07-01T10:00:00",
            }
        ],
        "safety_viewer_policy": [
            {
                "analysis_id": "a1",
                "equipment_id": "e1",
                "policy_id": "p1",
                "safety_preview_items": [
                    {
                        "no": 1,
                        "viewpoint_key": "guard",
                        "viewpoint_title": "방호장치",
                        "current_judgement": "개선 필요",
                        "required_evidences": ["photo"],
                    }
                ],
            }
        ],
        "user_safety_files": [
            {"analysis_id": "a1", "equipment_id": "e1", "policy_id": "p1", "viewpoint_key": "guard"}
        ],
        "safety_check_status": [
            {"company_id": "c1", "equipment_id": "e1", "status": "pending"}
        ],
        "safety_rule_legal": [{"rule_id": "l1", "inspection_type": "법정", "purpose": "안전장치"}],
        "safety_rule_voluntary": [{"rule_id": "v1", "inspection_type": "자율", "purpose": "교육"}],
        "chat_history": [{"chat_id": "s1", "company_id": "c1", "chat_history": []}],
    }


def _base_state(action: str, message: str = "테스트", analysis_id: str = "a1"):
    return {
        "company_id": "c1",
        "analysis_id": analysis_id,
        "action": action,
        "message": message,
        "user_query": message,
        "session_id": "s1",
        "is_safe": True,
        "chat_history": [],
        "simulation_input": {},
    }


def test_1_roi_detail_db_first(monkeypatch):
    monkeypatch.setattr(orch, "get_db", lambda: FakeDB(_fixtures()))
    state = _base_state("roi_detail")
    state = orch.entry_dispatch_node(state)
    state = orch.explicit_action_dispatch_node(state)
    state = orch.analysis_snapshot_loader_node(state)
    state = orch.roi_snapshot_node(state)
    state = response_node(state)
    assert state["metadata"]["used_graph"] is True
    assert state["metadata"]["used_llm"] is False
    assert state["metadata"]["used_roi_recalculation"] is False
    assert state["metadata"]["used_policy_matching"] is False


def test_2_roi_compare_uses_snapshot(monkeypatch):
    monkeypatch.setattr(orch, "get_db", lambda: FakeDB(_fixtures()))
    state = _base_state("roi_compare")
    state = orch.entry_dispatch_node(state)
    state = orch.explicit_action_dispatch_node(state)
    state = orch.analysis_snapshot_loader_node(state)
    state = orch.roi_snapshot_node(state)
    assert "A/B 비교" in state["response"]


def test_3_matched_policies_snapshot_only(monkeypatch):
    monkeypatch.setattr(orch, "get_db", lambda: FakeDB(_fixtures()))
    state = _base_state("matched_policies")
    state = orch.entry_dispatch_node(state)
    state = orch.explicit_action_dispatch_node(state)
    state = orch.analysis_snapshot_loader_node(state)
    state = orch.policy_snapshot_node(state)
    assert state["cards"][0]["type"] == "policy_snapshot_cards"


def test_4_policy_calendar_snapshot_only(monkeypatch):
    monkeypatch.setattr(orch, "get_db", lambda: FakeDB(_fixtures()))
    state = _base_state("policy_calendar")
    state = orch.entry_dispatch_node(state)
    state = orch.explicit_action_dispatch_node(state)
    state = orch.analysis_snapshot_loader_node(state)
    state = orch.calendar_snapshot_node(state)
    assert state["cards"][0]["type"] == "policy_calendar"


def test_5_draft_status_snapshot_only(monkeypatch):
    monkeypatch.setattr(orch, "get_db", lambda: FakeDB(_fixtures()))
    state = _base_state("application_draft_status")
    state = orch.entry_dispatch_node(state)
    state = orch.explicit_action_dispatch_node(state)
    state = orch.analysis_snapshot_loader_node(state)
    state = orch.draft_status_node(state)
    assert state["cards"][0]["data"]["status"] == "ready"


def test_6_safety_status_db_first(monkeypatch):
    fake_db = FakeDB(_fixtures())
    monkeypatch.setattr(orch, "get_db", lambda: fake_db)
    from app.agents import equipment_safety as safety_mod  # noqa: WPS433

    monkeypatch.setattr(safety_mod, "get_db", lambda: fake_db)
    state = _base_state("safety_status")
    state = orch.entry_dispatch_node(state)
    state = orch.explicit_action_dispatch_node(state)
    state = orch.analysis_snapshot_loader_node(state)
    state = orch.safety_snapshot_node(state)
    data = state["cards"][0]["data"]
    assert data["summary"]["total"] >= 1
    assert data["rule_sources"]["legal_count"] >= 1


def test_7_investment_simulation_temporary(monkeypatch):
    fake_db = FakeDB(_fixtures())
    monkeypatch.setattr(orch, "get_db", lambda: fake_db)
    calls = {"count": 0}

    def fake_calc(_equipment, energy_provided=True, policy_applications=None):
        calls["count"] += 1
        return _fixtures()["roi_output"][0]["roi_data"]

    monkeypatch.setattr(orch, "calculate_roi", fake_calc)
    state = _base_state("investment_simulation", message="투자금을 1억 5천만원으로 바꾸면?")
    state = orch.entry_dispatch_node(state)
    state = orch.explicit_action_dispatch_node(state)
    state = orch.analysis_snapshot_loader_node(state)
    state = orch.investment_simulation_node(state)
    assert calls["count"] == 1
    assert state["answer_source"] == "simulation"
    assert state["used_roi_recalculation"] is True
    assert fake_db.write_calls == []


def test_8_new_analysis_routes_to_equipment_selection(monkeypatch):
    monkeypatch.setattr(orch, "get_db", lambda: FakeDB(_fixtures()))
    state = _base_state("", message="새 설비 ROI 분석해줘", analysis_id="")
    state["company_equipments"] = _fixtures()["equipment"]
    state = orch.entry_dispatch_node(state)
    assert state["route"] == "new_analysis"
    state = orch.new_analysis_node(state)
    assert state["cards"][0]["type"] == "equipment_selection"


def test_9_greeting_uses_conversation_fallback():
    state = _base_state("", message="안녕", analysis_id="")
    state = orch.entry_dispatch_node(state)
    assert state["route"] == "conversation_fallback"


def test_10_legacy_policy_snapshot_missing(monkeypatch):
    tables = _fixtures()
    tables["roi_output"][0]["policy_snapshot"] = {}
    monkeypatch.setattr(orch, "get_db", lambda: FakeDB(tables))
    state = _base_state("matched_policies")
    state = orch.entry_dispatch_node(state)
    state = orch.explicit_action_dispatch_node(state)
    state = orch.analysis_snapshot_loader_node(state)
    state = orch.policy_snapshot_node(state)
    assert state["cards"][0]["type"] == "legacy_policy_snapshot_missing"


def test_11_session_id_persists_across_messages(monkeypatch):
    monkeypatch.setattr(svc, "_load_company_context", lambda _cid: None)
    monkeypatch.setattr(svc, "_load_company_equipments", lambda _cid: [])
    monkeypatch.setattr(svc, "_resolve_equipment_from_analysis", lambda _cid, _aid: "")
    monkeypatch.setattr(svc, "_latest_analysis_id", lambda _cid: "")
    monkeypatch.setattr(
        svc,
        "_get_session_row",
        lambda _cid, _sid: SimpleNamespace(
            data=[{"chat_id": _sid, "company_id": _cid, "chat_history": [], "roi_result": {}}]
        ),
    )

    captured = []

    def fake_upsert_session(**kwargs):
        captured.append(kwargs["session_id"])
        return True

    monkeypatch.setattr(svc, "_upsert_session", fake_upsert_session)

    class FakeGraph:
        async def ainvoke(self, _state):
            return {
                "intent": "response",
                "response": "ok",
                "cards": [],
                "metadata": {"answer_source": "conversation", "used_graph": True},
                "analysis_id": "",
                "equipment_id": "",
            }

    monkeypatch.setattr(svc, "factofit_graph", FakeGraph())

    req = SimpleNamespace(
        company_id="c1",
        message="안녕",
        chat_history=[],
        selected_equipment_id="",
        policy_intent_choice="",
        analysis_id="",
        source="",
        action="",
        policy_id="",
        simulation_input={},
        chat_id="s-fixed",
        session_id="s-fixed",
    )

    asyncio.run(svc.AdvisorChatService.handle_chat(req))
    asyncio.run(svc.AdvisorChatService.handle_chat(req))
    asyncio.run(svc.AdvisorChatService.handle_chat(req))
    assert captured == ["s-fixed", "s-fixed", "s-fixed"]


def test_build_safety_snapshot_reads_rules(monkeypatch):
    fake_db = FakeDB(_fixtures())
    from app.agents import equipment_safety as safety_mod  # noqa: WPS433

    monkeypatch.setattr(safety_mod, "get_db", lambda: fake_db)
    snapshot = build_safety_snapshot(company_id="c1", analysis_id="a1", equipment_id="e1", policy_id="p1")
    assert snapshot["rule_sources"]["legal_count"] == 1
    assert snapshot["rule_sources"]["voluntary_count"] == 1


def test_api_chat_testclient_smoke(monkeypatch):
    async def fake_handle_chat(_req):
        return {
            "intent": "response",
            "action": "roi_detail",
            "response": "ok",
            "cards": [],
            "chat_id": "s1",
            "session_id": "s1",
            "analysis_id": "a1",
            "metadata": {
                "answer_source": "database",
                "used_graph": True,
                "used_llm": False,
                "used_roi_recalculation": False,
                "used_policy_matching": False,
                "persistence_status": "success",
            },
        }

    monkeypatch.setattr(svc.AdvisorChatService, "handle_chat", staticmethod(fake_handle_chat))
    client = TestClient(app)
    res = client.post(
        "/api/chat",
        json={
            "company_id": "c1",
            "message": "ROI 보여줘",
            "chat_history": [],
            "analysis_id": "a1",
            "action": "roi_detail",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["intent"] == "response"
    assert body["metadata"]["used_graph"] is True
    assert body["metadata"]["persistence_status"] == "success"
