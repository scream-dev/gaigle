const API_BASE = window.GAIGLE_API_BASE || "";

/**
 * Единственная точка общения с бэкендом.
 * mode: "search" | "make_longer" | "follow_up"
 * Возвращает { fastAnswer, results: [{title, url, description}] }
 */
export async function search({ query, lang, mode = "search", context = {}, signal }) {
    const response = await fetch(`${API_BASE}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, lang, mode, context }),
        signal,
    });

    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }

    return response.json();
}
