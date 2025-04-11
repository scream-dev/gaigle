// Main application logic
document.addEventListener('DOMContentLoaded', function() {
    // Initialize language
    initLanguage();
    
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-icon-button');
    const resultsContainer = document.getElementById('results-container');
    const loadingElement = document.getElementById('loading');
    const rateLimitError = document.getElementById('rate-limit-error');
    const loadMoreButton = document.getElementById('load-more-button');
    const loadMoreContainer = document.getElementById('load-more-container');
    const mainContent = document.getElementById('main-content');
    
    // Handle search when button is clicked
    searchButton.addEventListener('click', performSearch);
    
    // Handle search when Enter key is pressed
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Handle load more button
    loadMoreButton.addEventListener('click', function() {
        performSearch(currentQuery, true);
    });
    
    async function performSearch(query, isLoadMore = false, customPrompt = '') {
        try {
            if (!isLoadMore && !customPrompt) {
                query = searchInput.value.trim();
                currentQuery = query;
                
                if (query === '') {
                    return;
                }
            }

            // Rate limiting check
            const now = Date.now();
            const timeSinceLastRequest = (now - lastRequestTime) / 1000;
            
            if (rateLimitActive && timeSinceLastRequest < 15) {
                const lang = getCookie('lang') || 'en';
                rateLimitError.textContent = translations[lang].rateLimitWarning;
                rateLimitError.style.display = 'block';
                return;
            }
            
            if (rateLimitSlowdown && timeSinceLastRequest < 3) {
                const lang = getCookie('lang') || 'en';
                rateLimitError.textContent = translations[lang].rateLimitSlowdown;
                rateLimitError.style.display = 'block';
                return;
            }

            // Update rate limiting counters
            requestCount++;
            lastRequestTime = now;
            
            if (requestCount >= 5 && timeSinceLastRequest < 10) {
                if (requestCount >= 10) {
                    rateLimitActive = true;
                    setTimeout(() => {
                        rateLimitActive = false;
                        requestCount = 0;
                    }, 15000);
                } else {
                    rateLimitSlowdown = true;
                    setTimeout(() => {
                        rateLimitSlowdown = false;
                        requestCount = 0;
                    }, 10000);
                }
            }

            // Hide rate limit error if shown
            rateLimitError.style.display = 'none';

            // Clear previous results if not loading more and not custom prompt
            if (!isLoadMore && !customPrompt) {
                resultsContainer.innerHTML = '';
                loadMoreContainer.style.display = 'none';
            }

            // Show loading indicator
            loadingElement.style.display = 'block';

            // Get current language
            const lang = getCookie('lang') || 'en';

            // Prepare the API request
            const apiUrl = 'http://api.onlysq.ru/ai/v2';
            let prompt;
            
            if (customPrompt === 'make_longer') {
                prompt = lang === 'ru' 
                    ? `Исходный запрос: ${currentQuery}\nПредыдущий ответ: ${currentFastAnswer}\nСделай ответ более подробным и развернутым.`
                    : `Original query: ${currentQuery}\nPrevious answer: ${currentFastAnswer}\nMake the answer more detailed and comprehensive.`;
            } else if (customPrompt) {
                prompt = lang === 'ru' 
                    ? `Исходный запрос: ${currentQuery}\nПредыдущий ответ: ${currentFastAnswer}\nДополнительный вопрос: ${customPrompt}`
                    : `Original query: ${currentQuery}\nPrevious answer: ${currentFastAnswer}\nFollow-up question: ${customPrompt}`;
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

            // Make the API request
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Hide loading indicator
            loadingElement.style.display = 'none';

            // Process the response
            if (data.answer) {
                if (customPrompt) {
                    // For custom prompts, update the fast answer
                    currentFastAnswer = data.answer;
                    const newAnswerElement = document.createElement('div');
                    newAnswerElement.className = 'fast-answer';
                    createFastAnswerElement(newAnswerElement, data.answer, lang);
                    resultsContainer.prepend(newAnswerElement);
                } else {
                    displayResults(data.answer, lang, isLoadMore);
                }
            } else {
                const lang = getCookie('lang') || 'en';
                resultsContainer.innerHTML = `<p>${translations[lang].noResults}</p>`;
            }
        } catch (error) {
            console.error('Error during search:', error);
            loadingElement.style.display = 'none';
            
            const lang = getCookie('lang') || 'en';
            let errorMessage = translations[lang].errorMessage;
            
            // More specific error messages
            if (error.message.includes('Failed to fetch')) {
                errorMessage = translations[lang].networkError || 'Network error. Please check your connection.';
            } else if (error.message.includes('HTTP error')) {
                errorMessage = translations[lang].apiError || 'API server error. Please try again later.';
            }
            
            resultsContainer.innerHTML = `<p>${errorMessage}</p>`;
            loadMoreContainer.style.display = 'none';
        }
    }

    function createFastAnswerElement(element, answer, lang) {
        const promptInputId = 'fast-answer-prompt-' + Date.now();
        
        element.innerHTML = `
            <div class="fast-answer-title">${translations[lang].quickAnswer}</div>
            <div>${answer}</div>
            <div class="fast-answer-actions">
                <button class="fast-answer-button" onclick="performSearch('', false, 'make_longer')">
                    ${translations[lang].makeLonger}
                </button>
            </div>
            <div class="fast-answer-input-container">
                <input type="text" class="fast-answer-input" id="${promptInputId}" placeholder="${translations[lang].customPrompt}">
                <button class="fast-answer-submit" onclick="
                    const input = document.getElementById('${promptInputId}');
                    const prompt = input.value.trim();
                    if (prompt) {
                        performSearch('', false, prompt);
                    }
                ">→</button>
            </div>
        `;
        
        // Add event listener for custom prompt input
        document.getElementById(promptInputId).addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const prompt = this.value.trim();
                if (prompt) {
                    performSearch('', false, prompt);
                }
            }
        });
    }

    function displayResults(answer, lang, isLoadMore = false) {
        // Parse the response
        const lines = answer.split('\n');
        let currentResult = {};
        let results = [];
        let fastAnswer = '';
        
        // Check for fast answer (only on first load)
        if (!isLoadMore && lines[0].startsWith('fast=')) {
            fastAnswer = lines[0].substring(5);
            currentFastAnswer = fastAnswer;
        }
        
        // Parse the results
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('1=')) {
                currentResult.title = line.substring(2);
            } else if (line.startsWith('2=')) {
                // Fix URL format if it contains markdown-style links
                let url = line.substring(2);
                url = url.replace(/\[.*?\]\((.*?)\)/g, '$1'); // Remove markdown links
                currentResult.url = url;
            } else if (line.startsWith('3=')) {
                currentResult.description = line.substring(2);
                results.push(currentResult);
                currentResult = {};
            }
        }
        
        // Display fast answer if available (only on first load)
        if (!isLoadMore && fastAnswer) {
            const fastAnswerElement = document.createElement('div');
            fastAnswerElement.className = 'fast-answer';
            createFastAnswerElement(fastAnswerElement, fastAnswer, lang);
            resultsContainer.appendChild(fastAnswerElement);
        }
        
        // Display search results
        if (results.length > 0) {
            results.forEach(result => {
                const resultElement = document.createElement('div');
                resultElement.className = 'result';
                
                // Create a proper URL if it doesn't start with http
                let displayUrl = result.url;
                if (!displayUrl.startsWith('http')) {
                    displayUrl = 'https://' + displayUrl;
                }
                
                // Ensure URL is clean and clickable
                displayUrl = displayUrl.replace(/[<>]/g, '');
                
                // Get domain for favicon
                let domain;
                try {
                    domain = new URL(displayUrl).hostname.replace('www.', '');
                } catch {
                    domain = displayUrl.split('/')[0];
                }
                
                resultElement.innerHTML = `
                    <img class="result-icon" src="https://www.google.com/s2/favicons?domain=${domain}" alt="${domain} icon">
                    <div class="result-content">
                        <a href="${displayUrl}" class="result-title" target="_blank" rel="noopener noreferrer">${result.title || displayUrl}</a>
                        <div class="result-url">${displayUrl}</div>
                        <div class="result-description">${result.description}</div>
                    </div>
                `;
                
                resultsContainer.appendChild(resultElement);
            });
            
            // Show load more button
            loadMoreContainer.style.display = 'block';
            
            // Scroll to results if we're not loading more
            if (!isLoadMore) {
                resultsContainer.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (!isLoadMore) {
            resultsContainer.innerHTML = `<p>${translations[lang].noResults}</p>`;
            loadMoreContainer.style.display = 'none';
        }
    }

    // Make performSearch available globally
    window.performSearch = performSearch;
});
