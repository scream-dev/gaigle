import { translations, russianSpeakingCountries } from "./translations.js";
import { search } from "./api.js";

const state = {
    lang: "en",
    query: "",
    fastAnswer: "",
    activeRequests: 0,
};

let abortController = new AbortController();

const $ = (id) => document.getElementById(id);
const t = (key) => translations[state.lang][key];

// --- Cookies ---
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = `${name}=${value || ""}${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? match[1] : null;
}

// --- Language ---
async function initLanguage() {
    const saved = getCookie("lang");
    if (saved === "en" || saved === "ru") {
        applyLanguage(saved);
        return;
    }
    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        const lang = russianSpeakingCountries.includes(data.country) ? "ru" : "en";
        applyLanguage(lang);
        setCookie("lang", lang, 3);
    } catch {
        applyLanguage("en");
        setCookie("lang", "en", 3);
    }
}

function applyLanguage(lang) {
    state.lang = translations[lang] ? lang : "en";
    document.title = t("pageTitle");
    $("search-input").placeholder = t("searchPlaceholder");
    $("loading-text").textContent = t("loadingText");
    $("load-more-button").textContent = t("loadMore");
    $("disclaimer").textContent = t("disclaimer");

    const switcher = $("language-switcher");
    switcher.innerHTML = "";
    const other = state.lang === "en" ? "ru" : "en";
    const button = document.createElement("button");
    button.textContent = state.lang === "en" ? t("switchToRussian") : t("switchToEnglish");
    button.addEventListener("click", () => {
        setCookie("lang", other, 3);
        window.location.reload();
    });
    switcher.appendChild(button);
}

// --- Safe markdown rendering (для быстрых ответов) ---
function formatMarkdown(escaped) {
    return escaped
        .replace(/^### (.*$)/gm, "<h3>$1</h3>")
        .replace(/^## (.*$)/gm, "<h2>$1</h2>")
        .replace(/^# (.*$)/gm, "<h1>$1</h1>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/__(.*?)__/g, "<strong>$1</strong>")
        .replace(/_(.*?)_/g, "<em>$1</em>")
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\n/g, "<br>");
}

function safeFormatText(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return formatMarkdown(div.innerHTML);
}

// --- UI helpers ---
function showError(message) {
    const el = $("error-container");
    el.textContent = message;
    el.style.display = "block";
}

function hideError() {
    $("error-container").style.display = "none";
}

function setLoading(delta) {
    state.activeRequests = Math.max(0, state.activeRequests + delta);
    $("loading").style.display = state.activeRequests > 0 ? "block" : "none";
}

function errorMessage(error) {
    if (error.name === "AbortError") return null;
    if (error.status === 429) return t("rateLimitExceeded");
    if (error.status === 400) return t("invalidRequest");
    if (error.status === 504) return t("apiTimeout");
    if (error.status >= 500) return t("serverError");
    if (error instanceof TypeError) return t("networkError");
    return t("errorMessage");
}

// --- Rendering ---
function renderFastAnswer(text, { prepend = false } = {}) {
    const container = document.createElement("div");
    container.className = "fast-answer";

    const title = document.createElement("div");
    title.className = "fast-answer-title";
    title.textContent = t("quickAnswer");

    const body = document.createElement("div");
    body.innerHTML = safeFormatText(text);

    const actions = document.createElement("div");
    actions.className = "fast-answer-actions";
    const longerButton = document.createElement("button");
    longerButton.className = "fast-answer-button";
    longerButton.textContent = t("makeLonger");
    longerButton.addEventListener("click", () => runSearch({ mode: "make_longer" }));
    actions.appendChild(longerButton);

    const inputContainer = document.createElement("div");
    inputContainer.className = "fast-answer-input-container";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "fast-answer-input";
    input.placeholder = t("customPrompt");
    const submit = document.createElement("button");
    submit.className = "fast-answer-submit";
    submit.textContent = "→";
    const sendFollowUp = () => {
        const prompt = input.value.trim();
        if (prompt) runSearch({ mode: "follow_up", followUp: prompt });
    };
    submit.addEventListener("click", sendFollowUp);
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendFollowUp();
    });
    inputContainer.append(input, submit);

    container.append(title, body, actions, inputContainer);

    const results = $("results-container");
    if (prepend) results.prepend(container);
    else results.appendChild(container);
}

function renderResults(results) {
    const container = $("results-container");

    for (const result of results) {
        let displayUrl = result.url.startsWith("http") ? result.url : `https://${result.url}`;
        displayUrl = displayUrl.replace(/[<>]/g, "");

        let domain;
        try {
            domain = new URL(displayUrl).hostname.replace("www.", "");
        } catch {
            domain = displayUrl.split("/")[0];
        }

        const item = document.createElement("div");
        item.className = "result";

        const icon = document.createElement("img");
        icon.className = "result-icon";
        icon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}`;
        icon.alt = "";

        const content = document.createElement("div");
        content.className = "result-content";

        const link = document.createElement("a");
        link.className = "result-title";
        link.href = displayUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = result.title || displayUrl;

        const urlEl = document.createElement("div");
        urlEl.className = "result-url";
        urlEl.textContent = displayUrl;

        const description = document.createElement("div");
        description.className = "result-description";
        description.textContent = result.description || "";

        content.append(link, urlEl, description);
        item.append(icon, content);
        container.appendChild(item);
    }
}

// --- Search flow ---
async function runSearch({ mode = "search", followUp = "", append = false } = {}) {
    abortController.abort();
    abortController = new AbortController();

    let query;
    if (mode === "search") {
        query = append ? state.query : $("search-input").value.trim();
        if (!query) return;
        state.query = query;
    } else {
        query = mode === "follow_up" ? followUp : state.query;
        if (!query) return;
    }

    hideError();
    if (mode === "search" && !append) {
        $("results-container").innerHTML = "";
        $("load-more-container").style.display = "none";
    }
    setLoading(1);

    try {
        const data = await search({
            query,
            lang: state.lang,
            mode,
            context: { query: state.query, previousAnswer: state.fastAnswer },
            signal: abortController.signal,
        });
        setLoading(-1);

        if (mode !== "search") {
            state.fastAnswer = data.fastAnswer;
            renderFastAnswer(data.fastAnswer, { prepend: true });
            return;
        }

        if (!append && data.fastAnswer) {
            state.fastAnswer = data.fastAnswer;
            renderFastAnswer(data.fastAnswer);
        }

        if (data.results.length > 0) {
            renderResults(data.results);
            $("load-more-container").style.display = "block";
            if (!append) {
                $("results-container").scrollIntoView({ behavior: "smooth" });
            }
        } else if (!append && !data.fastAnswer) {
            $("results-container").innerHTML = `<p>${t("noResults")}</p>`;
        }
    } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Search error:", error);
        setLoading(-1);
        const message = errorMessage(error);
        if (message) showError(message);
    }
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
    initLanguage();

    $("search-icon-button").addEventListener("click", () => runSearch());
    $("search-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") runSearch();
    });
    $("load-more-button").addEventListener("click", () => runSearch({ append: true }));
});
