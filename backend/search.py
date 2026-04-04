import requests

from config import SEARCH_API_KEY


def search_google(query: str) -> list[str]:
    if not query.strip() or not SEARCH_API_KEY:
        return []

    url = "https://www.searchapi.io/api/v1/search"
    params = {
        "engine": "google",
        "q": query,
        "api_key": SEARCH_API_KEY,
        "num": 3,
    }

    try:
        response = requests.get(url, params=params, timeout=12)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException:
        return []

    results: list[str] = []
    for item in data.get("organic_results", [])[:3]:
        title = item.get("title", "Untitled")
        snippet = item.get("snippet", "")
        link = item.get("link", "")
        results.append(f"{title}: {snippet} ({link})")

    return results