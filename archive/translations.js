// Translations and configurations
const translations = {
    en: {
        pageTitle: "Gaigle - AI-Powered Search",
        searchPlaceholder: "Search with Gaigle...",
        aboutLink: "About",
        settingsLink: "Settings",
        loadingText: "Searching with AI...",
        quickAnswer: "Quick Answer",
        noResults: "No results found. Try a different query.",
        errorMessage: "Unknown error occurred while searching. Please try again.",
        networkError: "Network error. Please check your internet connection.",
        apiError: "API server error. Please try again later.",
        apiTimeout: "The server is taking too long to respond",
        invalidRequest: "Invalid search query",
        serverError: "Server is currently unavailable. Please try again later.",
        rateLimitExceeded: "Too many requests. Please wait before trying again.",
        switchToRussian: "Русский",
        switchToEnglish: "English",
        loadMore: "More",
        makeLonger: "Make longer",
        customPrompt: "Ask a follow-up question...",
        rateLimitWarning: "Too many requests! Please wait 15 seconds before searching again.",
        rateLimitSlowdown: "Too many requests! You can now make 1 request every 3 seconds.",
        disclaimer: "This website is not affiliated with Google Corporation, and is not produced by it. All answers are made by AI and might not be 100% correct."
    },
    ru: {
        pageTitle: "Gaigle - Поиск с ИИ",
        searchPlaceholder: "Поиск с помощью Gaigle...",
        aboutLink: "О сервисе",
        settingsLink: "Настройки",
        loadingText: "Ищем с помощью ИИ...",
        quickAnswer: "Быстрый ответ",
        noResults: "Ничего не найдено. Попробуйте другой запрос.",
        errorMessage: "Произошла ошибка при поиске. Пожалуйста, попробуйте ещё раз.",
        networkError: "Ошибка сети. Пожалуйста, проверьте интернет-соединение.",
        apiError: "Ошибка сервера API. Пожалуйста, попробуйте позже.",
        apiTimeout: "Сервер слишком долго отвечает",
        invalidRequest: "Некорректный поисковый запрос",
        serverError: "Сервер временно недоступен",
        rateLimitExceeded: "Слишком много запросов. Пожалуйста, подождите перед повторной попыткой.",
        switchToRussian: "Русский",
        switchToEnglish: "English",
        loadMore: "Ещё",
        makeLonger: "Длиннее",
        customPrompt: "Уточняющий вопрос...",
        rateLimitWarning: "Слишком много запросов! Пожалуйста, подождите 15 секунд перед новым поиском.",
        rateLimitSlowdown: "Слишком много запросов! Теперь вы можете делать 1 запрос каждые 3 секунды.",
        disclaimer: "Данный сайт никак не связан с корпорацией Google, и не производится ей. Все ответы делаются нейросетью и не могут быть верны на 100%."
    }
};

// Countries where Russian should be default
const russianSpeakingCountries = ['RU', 'BY', 'UA', 'KZ'];

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    maxRequests: 5,
    timeWindow: 10, // seconds
    slowdownAfter: 10,
    slowdownDelay: 3, // seconds between requests
    banAfter: 15,
    banDuration: 15 // seconds
};

// API configuration
const API_CONFIG = {
    endpoints: [
        'https://api.onlysq.ru/ai/v2',
        'https://backup-api.onlysq.ru/ai/v2'
    ],
    timeout: 10000, // 10 seconds
    retries: 2
};
