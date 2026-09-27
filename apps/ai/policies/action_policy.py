"""
Risk-tier classification per AI.md "Action Risk". Only read_only tools
are registered right now (tools/registry.py) — this exists so write
tools can be added later without redesigning the executor.
"""

RISK_TIERS = {
    "read_only": "auto",
    "low_risk": "auto",
    "high_risk": "requires_confirmation",
}


def requires_confirmation(risk_tier: str) -> bool:
    return RISK_TIERS.get(risk_tier, "requires_confirmation") == "requires_confirmation"
