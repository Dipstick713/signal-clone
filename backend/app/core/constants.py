"""Shared constants."""

# Signal-style avatar accent colours used for coloured-initial avatars.
AVATAR_COLORS: list[str] = [
    "#2c6bed",  # ultramarine (Signal blue)
    "#6a5cff",  # indigo
    "#c065b5",  # plum
    "#e2637a",  # rose
    "#eb7409",  # tangerine
    "#c89c14",  # gold
    "#3ba55d",  # green
    "#1aa5a5",  # teal
]


def color_for(seed: str) -> str:
    """Pick a stable avatar colour for a given seed (e.g. a username)."""
    return AVATAR_COLORS[sum(ord(c) for c in seed) % len(AVATAR_COLORS)]
