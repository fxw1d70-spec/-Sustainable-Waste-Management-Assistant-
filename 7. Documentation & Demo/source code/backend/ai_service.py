"""
AI waste-classification service for WasteGuide AI.

Primary path : Groq API (llama-3.3-70b-versatile) with a strict JSON prompt.
Fallback path: a deterministic rule-based classifier so the app is fully
               functional even without a GROQ_API_KEY.
"""

import json
import os
import re

# The Groq SDK is optional at runtime — import defensively so a missing
# dependency degrades to the rule-based classifier instead of crashing.
try:
    from groq import Groq
except Exception:  # pragma: no cover - import guard
    Groq = None


VALID_CATEGORIES = [
    "Plastic Waste",
    "Paper Waste",
    "Organic Waste",
    "E-Waste",
    "Hazardous Waste",
    "Metal Waste",
    "Glass Waste",
    "General Waste",
]

SYSTEM_PROMPT = (
    "You are WasteGuide AI, an expert assistant for sustainable urban waste "
    "management. Classify the waste item the user names and return ONLY a JSON "
    "object (no markdown, no commentary) with EXACTLY these keys:\n"
    '  "category": one of '
    + ", ".join(VALID_CATEGORIES)
    + "\n"
    '  "recyclable": boolean\n'
    '  "hazard_level": one of "None", "Low", "Medium", "High"\n'
    '  "hazard_warning": string (empty string if no hazard)\n'
    '  "disposal_steps": array of 3-5 short imperative strings\n'
    '  "recycling_instructions": array of 2-4 short strings (empty array if not recyclable)\n'
    '  "eco_suggestions": array of 2-3 short eco-friendly alternative tips\n'
    '  "accepted_facilities": array of facility types that accept this item, '
    'chosen from ["recycling", "e-waste", "organic", "hazardous", "general"]\n'
    "Keep every string concise and practical for a resident in a smart city."
)


# ─────────────────────────── Rule-based fallback ───────────────────────────

# Keyword -> classification profile. First matching keyword wins.
_RULES = [
    (
        ["battery", "batteries", "power bank", "lithium"],
        {
            "category": "Hazardous Waste",
            "recyclable": True,
            "hazard_level": "High",
            "hazard_warning": "Contains toxic heavy metals and corrosive "
            "chemicals. Never throw in household trash or incinerate — risk of "
            "fire and soil/water contamination.",
            "disposal_steps": [
                "Do not place in regular household bins.",
                "Tape the terminals of lithium batteries to prevent short circuits.",
                "Store in a cool, dry container until drop-off.",
                "Take to a certified battery or hazardous-waste collection point.",
            ],
            "recycling_instructions": [
                "Deliver to a certified battery recycling drop-off.",
                "Many electronics retailers accept used batteries for free.",
            ],
            "eco_suggestions": [
                "Switch to rechargeable batteries to cut long-term waste.",
                "Choose devices with USB-C charging where possible.",
            ],
            "accepted_facilities": ["hazardous", "e-waste"],
        },
    ),
    (
        ["phone", "laptop", "computer", "charger", "cable", "electronic",
         "tv", "monitor", "keyboard", "mouse", "tablet", "circuit"],
        {
            "category": "E-Waste",
            "recyclable": True,
            "hazard_level": "Medium",
            "hazard_warning": "Electronics may contain lead, mercury and flame "
            "retardants. Do not break the screen or casing.",
            "disposal_steps": [
                "Back up and factory-reset the device to wipe personal data.",
                "Remove any detachable batteries and handle them separately.",
                "Keep the device intact — avoid breaking screens.",
                "Drop off at a certified e-waste collection center.",
            ],
            "recycling_instructions": [
                "Use a certified e-waste recycler to recover metals safely.",
                "Manufacturer take-back programs often accept old devices.",
            ],
            "eco_suggestions": [
                "Repair or donate working electronics before recycling.",
                "Buy refurbished devices to reduce e-waste demand.",
            ],
            "accepted_facilities": ["e-waste", "recycling"],
        },
    ),
    (
        ["plastic", "bottle", "wrapper", "packaging", "polythene", "straw",
         "container", "cup"],
        {
            "category": "Plastic Waste",
            "recyclable": True,
            "hazard_level": "Low",
            "hazard_warning": "",
            "disposal_steps": [
                "Empty and rinse the item to remove residue.",
                "Remove and separate the cap or lid if a different plastic.",
                "Flatten to save space.",
                "Place in the recycling bin or take to a recycling center.",
            ],
            "recycling_instructions": [
                "Rinse thoroughly so it is accepted by recyclers.",
                "Remove caps and labels where required by local rules.",
                "Check the resin code (1-PET, 2-HDPE recycle most easily).",
            ],
            "eco_suggestions": [
                "Switch to a reusable water bottle.",
                "Choose products with minimal plastic packaging.",
            ],
            "accepted_facilities": ["recycling"],
        },
    ),
    (
        ["paper", "cardboard", "newspaper", "magazine", "carton", "book",
         "box"],
        {
            "category": "Paper Waste",
            "recyclable": True,
            "hazard_level": "None",
            "hazard_warning": "",
            "disposal_steps": [
                "Keep the paper clean and dry.",
                "Flatten cardboard boxes to save space.",
                "Remove any plastic tape or non-paper packaging.",
                "Place in the paper recycling bin.",
            ],
            "recycling_instructions": [
                "Avoid recycling greasy or food-soiled paper.",
                "Bundle loose paper so it is not lost in sorting.",
            ],
            "eco_suggestions": [
                "Go paperless with digital bills and notes.",
                "Reuse the blank side of paper before recycling.",
            ],
            "accepted_facilities": ["recycling"],
        },
    ),
    (
        ["food", "vegetable", "fruit", "organic", "leftover", "peel",
         "compost", "leaf", "leaves", "garden", "eggshell", "tea"],
        {
            "category": "Organic Waste",
            "recyclable": True,
            "hazard_level": "None",
            "hazard_warning": "",
            "disposal_steps": [
                "Separate food scraps from packaging.",
                "Collect in a dedicated compost or organic-waste caddy.",
                "Avoid adding meat or dairy to home compost bins.",
                "Deposit at an organic-waste collection point or compost it.",
            ],
            "recycling_instructions": [
                "Compost at home to create nutrient-rich soil.",
                "Use municipal organic (green) bin collection where available.",
            ],
            "eco_suggestions": [
                "Plan meals to reduce food waste.",
                "Start a home compost bin for kitchen scraps.",
            ],
            "accepted_facilities": ["organic"],
        },
    ),
    (
        ["glass", "jar", "mirror"],
        {
            "category": "Glass Waste",
            "recyclable": True,
            "hazard_level": "Low",
            "hazard_warning": "Broken glass can cause cuts — wrap sharp pieces "
            "before disposal.",
            "disposal_steps": [
                "Empty and rinse the glass container.",
                "Remove lids and corks.",
                "Wrap broken glass in paper before binning.",
                "Place in the glass recycling bin.",
            ],
            "recycling_instructions": [
                "Separate by color if your program requires it.",
                "Do not mix ceramics or Pyrex with recyclable glass.",
            ],
            "eco_suggestions": [
                "Reuse glass jars for storage.",
                "Prefer glass over single-use plastic where practical.",
            ],
            "accepted_facilities": ["recycling"],
        },
    ),
    (
        ["metal", "can", "tin", "aluminium", "aluminum", "foil", "steel"],
        {
            "category": "Metal Waste",
            "recyclable": True,
            "hazard_level": "None",
            "hazard_warning": "",
            "disposal_steps": [
                "Empty and rinse the can or container.",
                "Remove paper labels if required locally.",
                "Crush cans to save space.",
                "Place in the metal recycling bin.",
            ],
            "recycling_instructions": [
                "Aluminium and steel are infinitely recyclable — always recycle.",
                "Collect clean foil into a ball so it is not lost in sorting.",
            ],
            "eco_suggestions": [
                "Choose refillable containers over single-use cans.",
                "Recycle metal — it saves large amounts of energy.",
            ],
            "accepted_facilities": ["recycling"],
        },
    ),
    (
        ["paint", "chemical", "pesticide", "solvent", "oil", "bleach",
         "cleaner", "medicine", "syringe", "bulb", "fluorescent", "aerosol"],
        {
            "category": "Hazardous Waste",
            "recyclable": False,
            "hazard_level": "High",
            "hazard_warning": "Toxic and/or flammable. Keep in original "
            "labelled container and away from children, heat and drains.",
            "disposal_steps": [
                "Keep the product in its original, sealed container.",
                "Never pour down drains or place in household bins.",
                "Store upright in a ventilated area away from heat.",
                "Deliver to a hazardous-waste collection facility.",
            ],
            "recycling_instructions": [],
            "eco_suggestions": [
                "Buy only the quantity of chemicals you need.",
                "Prefer non-toxic, biodegradable alternatives.",
            ],
            "accepted_facilities": ["hazardous"],
        },
    ),
]

_GENERAL_PROFILE = {
    "category": "General Waste",
    "recyclable": False,
    "hazard_level": "None",
    "hazard_warning": "",
    "disposal_steps": [
        "Check local guidance for this specific item.",
        "If it cannot be recycled or composted, use the general-waste bin.",
        "Keep the item dry and bagged to avoid contamination.",
    ],
    "recycling_instructions": [],
    "eco_suggestions": [
        "Look for reusable or recyclable alternatives next time.",
        "Reduce consumption of single-use items.",
    ],
    "accepted_facilities": ["general"],
}


def _rule_based_classify(item: str) -> dict:
    """Deterministic classifier used when Groq is unavailable."""
    text = item.lower()
    for keywords, profile in _RULES:
        if any(re.search(rf"\b{re.escape(k)}", text) for k in keywords):
            result = dict(profile)
            result["source"] = "rule-based"
            return result
    result = dict(_GENERAL_PROFILE)
    result["source"] = "rule-based"
    return result


# ─────────────────────────────── Groq path ───────────────────────────────

def _extract_json(content: str) -> dict:
    """Pull the first JSON object out of a model response."""
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in model response")
    return json.loads(match.group(0))


def _normalize(data: dict, item: str) -> dict:
    """Coerce a raw result into the shape the frontend expects."""
    category = data.get("category", "General Waste")
    if category not in VALID_CATEGORIES:
        category = "General Waste"

    def _as_list(value):
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if value:
            return [str(value).strip()]
        return []

    hazard_level = str(data.get("hazard_level", "None")).capitalize()
    if hazard_level not in ("None", "Low", "Medium", "High"):
        hazard_level = "None"

    return {
        "item": item,
        "category": category,
        "recyclable": bool(data.get("recyclable", False)),
        "hazard_level": hazard_level,
        "hazard_warning": str(data.get("hazard_warning", "")).strip(),
        "disposal_steps": _as_list(data.get("disposal_steps")),
        "recycling_instructions": _as_list(data.get("recycling_instructions")),
        "eco_suggestions": _as_list(data.get("eco_suggestions")),
        "accepted_facilities": _as_list(data.get("accepted_facilities")) or ["general"],
        "source": data.get("source", "groq"),
    }


class AIService:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
        self.client = None
        if self.api_key and Groq is not None:
            try:
                self.client = Groq(api_key=self.api_key)
            except Exception as exc:  # pragma: no cover
                print(f"[ai_service] Groq init failed, using fallback: {exc}")
                self.client = None

    @property
    def using_groq(self) -> bool:
        return self.client is not None

    def classify(self, item: str) -> dict:
        item = (item or "").strip()
        if not item:
            raise ValueError("Waste item name is required")

        if self.client is not None:
            try:
                completion = self.client.chat.completions.create(
                    model=self.model,
                    temperature=0.3,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f"Waste item: {item}"},
                    ],
                )
                content = completion.choices[0].message.content
                data = _extract_json(content)
                data["source"] = "groq"
                return _normalize(data, item)
            except Exception as exc:
                print(f"[ai_service] Groq call failed, using fallback: {exc}")

        return _normalize(_rule_based_classify(item), item)
