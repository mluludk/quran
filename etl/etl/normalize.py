"""Arabic search normalization helpers (never applied to display text)."""

from __future__ import annotations

import re

# Tashkeel, small alifs, Quranic annotation marks
_ARABIC_DIACRITICS_RE = re.compile(
    r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]"
)
_TATWEEL_RE = re.compile(r"\u0640")


def normalize_arabic_search(text: str) -> str:
    """Return a search-normalized Arabic string without altering display forms."""
    if not text:
        return ""
    s = _ARABIC_DIACRITICS_RE.sub("", text)
    s = _TATWEEL_RE.sub("", s)
    # Normalize alif variants (including alif wasla ٱ U+0671) to bare alif ا
    s = s.replace("\u0671", "\u0627")
    s = s.replace("\u0623", "\u0627").replace("\u0625", "\u0627").replace("\u0622", "\u0627")
    # Normalize alif maqsurah ى -> ي and taa marbuta ة -> ه for search recall
    s = s.replace("\u0649", "\u064A").replace("\u0629", "\u0647")
    return s.strip()
