def normalize_text(value: str) -> str:
    """Trim and collapse repeated whitespace for cleaner prompt input."""
    return " ".join(value.split())