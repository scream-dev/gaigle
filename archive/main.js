// Main application logic
document.addEventListener('DOMContentLoaded', function() {
    // Initialize language
    initLanguage();
    
    // DOM elements
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-icon-button');
    const resultsContainer = document.getElementById('results-container');
    const loadingElement = document.getElementById('loading');
    const loadMoreButton = document.getElementById('load-more-button');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    // Event listeners
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') performSearch();
    });
    loadMoreButton.addEventListener('click', () => performSearch(appState.currentQuery, true));

    // Abort controller for API requests
    let abortController = new AbortController();

    async function performSearch(query, isLoadMore = false, customPrompt = '') {
        try {
            // Cancel previous request
            abortController.abort();
            abortController = new AbortController();
            
            if (!isLoadMore && !customPrompt) {
                query = searchInput.value.trim();
                appState.currentQuery = query;
                if (query === '') return;
            }

            // Rate limiting check
            const now = Date.now();
            const timeSinceLastRequest = (now - appState.lastRequestTime) / 1000;
            
            if (appState.rateLimitActive && timeSinceLastRequest < RATE_LIMIT_CONFIG.banDuration) {
                showError(translations[getCookie('lang') || 'en'].rateLimitWarning);
                return;
            }
            
            if (appState.rateLimitSlowdown && timeSinceLastRequest < RATE_LIMIT_CONFIG.slowdownDelay) {
                showError(translations[getCookie('lang') || 'en'].rateLimitSlowdown);
                return;
            }

            // Update rate limiting state
            appState.requestCount++;
            appState.lastRequestTime = now;
            
            if (appState.requestCount >= RATE_LIMIT_CONFIG.maxRequests && 
                timeSinceLastRequest < RATE_LIMIT_CONFIG.timeWindow) {
                if (appState.requestCount >= RATE_LIMIT_CONFIG.banAfter) {
                    appState.rateLimitActive = true;
                    setTimeout(() => {
                        appState.rateLimitActive = false;
                        appState.requestCount = 0;
                    }, RATE_LIMIT_CONFIG.banDuration * 1000);
                } else {
                    appState.rateLimitSlowdown = true;
                    setTimeout(() => {
                        appState.rateLimitSlowdown = false;
                        appState.requestCount = 0;
                    }, RATE_LIMIT_CONFIG.timeWindow * 1000);
                }
            }

            // UI updates
            hideError();
            if (!isLoadMore && !customPrompt) {
                resultsContainer.innerHTML = '';
                loadMoreContainer.style.display = 'none';
            }
            loadingElement.style.display = 'block';
            appState.activeRequests++;

            // Prepare API request
            const lang = getCookie('lang') || 'en';
            let prompt;
            
            if (customPrompt === 'make_longer') {
                prompt = lang === 'ru' 
                    ? `Исходный запрос: ${appState.currentQuery}\nПредыдущий ответ: ${appState.currentFastAnswer}\nСделай ответ более подробным и развернутым.`
                    : `Original query: ${appState.currentQuery}\nPrevious answer: ${appState.currentFastAnswer}\nMake the answer more detailed and comprehensive.`;
            } else if (customPrompt) {
                prompt = lang === 'ru' 
                    ? `Исходный запрос: ${appState.currentQuery}\nПредыдущий ответ: ${appState.currentFastAnswer}\nДополнительный вопрос: ${customPrompt}`
                    : `Original query: ${appState.currentQuery}\nPrevious answer: ${appState.currentFastAnswer}\nFollow-up question: ${customPrompt}`;
            } else {
                prompt = lang === 'ru' 
                    ? `считай что ты google, ищи информацию как он, дай 5 ответов на запрос "${query}" ссылкой на искомый ресурс и его название и описание. также попытайся в первой строчке ответить на вопрос быстрым ответом без захода на сайт. напиши так, каждый найденный ресурс сначала с пустой строчкой, потом уже следующий ресурс: 
                            1=Название сайта
                            2=Ссылка
                            3=Описание сайта
                            а быстрые ответы просто в самом вверху так:
                            fast=ответ`
                    : `consider that you are google, search for information like it does, give 5 answers to the query "${query}" with a link to the resource, its name and description. also try to answer the question in the first line with a quick answer without visiting the site. write it like this, each found resource first with an empty line, then the next resource:
                            1=Site name
                            2=Link
                            3=Site description
                            and quick answers just at the very top like:
                            fast=answer`;
            }

            const requestData = {
                model: "searchgpt",
                request: {
                    messages: [{
                        role: "user",
                        content: prompt
                    }]
                }
            };

            // Try multiple API endpoints
            let data;
            for (let i = 0; i < API_CONFIG.endpoints.length; i++) {
                try {
                    const response = await fetch(API_CONFIG.endpoints[i], {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(requestData),
                        signal: abortController.signal
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.message || `HTTP ${response.status}`);
                    }

                    data = await response.json();
                    if (data.answer) break;
                } catch (error) {
                    if (i === API_CONFIG.endpoints.length - 1) throw error;
                    console.warn(`Attempt ${i+1} failed:`, error);
                }
            }

            // Process response
            if (--appState.activeRequests === 0) {
                loadingElement.style.display = 'none';
            }

            if (data.answer) {
                if (customPrompt) {
                    appState.currentFastAnswer = data.answer;
                    const newAnswerElement = document.createElement('div');
                    newAnswerElement.className = 'fast-answer';
                    newAnswerElement.innerHTML = `
                        <div class="fast-answer-title">${translations[lang].quickAnswer}</div>
                        <div>${safeFormatText(data.answer)}</div>
                        <div class="fast-answer-actions">
                            <button class="fast-answer-button" onclick="performSearch('', false, 'make_longer')">
                                ${translations[lang].makeLonger}
                            </button>
                        </div>
                        <div class="fast-answer-input-container">
                            <input type="text" class="fast-answer-input" id="fast-answer-prompt-${Date.now()}" 
                                   placeholder="${translations[lang].customPrompt}">
                            <button class="fast-answer-submit" onclick="
                                const input = this.parentElement.querySelector('input');
                                const prompt = input.value.trim();
                                if (prompt) performSearch('', false, prompt);
                            ">→</button>
                        </div>
                    `;
                    resultsContainer.prepend(newAnswerElement);
                } else {
                    displayResults(data.answer, lang, isLoadMore);
                }
            } else {
                resultsContainer.innerHTML = `<p>${translations[lang].noResults}</p>`;
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Search Error:', error);
                if (--appState.activeRequests === 0) {
                    loadingElement.style.display = 'none';
                }
                showError(handleApiError(error));
                resultsContainer.innerHTML = '';
                loadMoreContainer.style.display = 'none';
            }
        }
    }

    function displayResults(answer, lang, isLoadMore = false) {
        const lines = answer.split('\n');
        let currentResult = {};
        let results = [];
        let fastAnswer = '';
        
        // Parse response
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('1=')) {
                currentResult.title = safeFormatText(line.substring(2));
            } else if (line.startsWith('2=')) {
                currentResult.url = line.substring(2).replace(/\[.*?\]\((.*?)\)/g, '$1');
            } else if (line.startsWith('3=')) {
                currentResult.description = safeFormatText(line.substring(2));
                results.push(currentResult);
                currentResult = {};
            } else if (i === 0 && line.startsWith('fast=')) {
                fastAnswer = safeFormatText(line.substring(5));
                appState.currentFastAnswer = fastAnswer;
            }
        }
        
        // Display fast answer
        if (!isLoadMore && fastAnswer) {
            const fastAnswerElement = document.createElement('div');
            fastAnswerElement.className = 'fast-answer';
            fastAnswerElement.innerHTML = `
                <div class="fast-answer-title">${translations[lang].quickAnswer}</div>
                <div>${fastAnswer}</div>
                <div class="fast-answer-actions">
                    <button class="fast-answer-button" onclick="performSearch('', false, 'make_longer')">
                        ${translations[lang].makeLonger}
                    </button>
                </div>
                <div class="fast-answer-input-container">
                    <input type="text" class="fast-answer-input" id="fast-answer-prompt-${Date.now()}" 
                           placeholder="${translations[lang].customPrompt}">
                    <button class="fast-answer-submit" onclick="
                        const input = this.parentElement.querySelector('input');
                        const prompt = input.value.trim();
                        if (prompt) performSearch('', false, prompt);
                    ">→</button>
                </div>
            `;
            resultsContainer.appendChild(fastAnswerElement);
        }
        
        // Display results
        if (results.length > 0) {
            results.forEach(result => {
                let displayUrl = result.url.startsWith('http') ? result.url : `https://${result.url}`;
                displayUrl = displayUrl.replace(/[<>]/g, '');
                
                let domain;
                try {
                    domain = new URL(displayUrl).hostname.replace('www.', '');
                } catch {
                    domain = displayUrl.split('/')[0];
                }
                
                const resultElement = document.createElement('div');
                resultElement.className = 'result';
                resultElement.innerHTML = `
                    <img class="result-icon" src="https://www.google.com/s2/favicons?domain=${domain}" alt="${domain} icon">
                    <div class="result-content">
                        <a href="${displayUrl}" class="result-title" target="_blank" rel="noopener noreferrer">
                            ${result.title || displayUrl}
                        </a>
                        <div class="result-url">${displayUrl}</div>
                        <div class="result-description">${result.description}</div>
                    </div>
                `;
                resultsContainer.appendChild(resultElement);
            });
            
            loadMoreContainer.style.display = 'block';
            if (!isLoadMore) {
                resultsContainer.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (!isLoadMore) {
            resultsContainer.innerHTML = `<p>${translations[lang].noResults}</p>`;
            loadMoreContainer.style.display = 'none';
        }
    }

    // Make functions available globally
    window.performSearch = performSearch;
    window.switchLanguage = switchLanguage;
});
