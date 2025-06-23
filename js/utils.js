        // Cookie functions
        function setCookie(name, value, days) {
            let expires = "";
            if (days) {
                const date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
        }

        function getCookie(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        }

        // Markdown formatting functions
        function formatTextWithMarkdown(text) {
            if (!text) return text;
            
            // Process headings
            text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
            text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
            text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
            
            // Process bold and italic
            text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
            text = text.replace(/\_\_(.*?)\_\_/g, '<strong>$1</strong>');
            text = text.replace(/\_(.*?)\_/g, '<em>$1</em>');
            
            // Process line breaks
            text = text.replace(/\n/g, '<br>');
            
            // Process links
            text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
            
            return text;
        }

        // Safe HTML rendering
        function safeFormatText(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return formatTextWithMarkdown(div.innerHTML);
        }

        // Error handling
        function handleApiError(error) {
            console.error('API Error:', error);
            const lang = getCookie('lang') || 'en';
            
            if (error.name === 'AbortError') {
                return translations[lang].apiTimeout;
            } else if (error.message.includes('NetworkError')) {
                return translations[lang].networkError;
            } else if (error.message.includes('400')) {
                return translations[lang].invalidRequest;
            } else if (error.message.includes('50')) {
                return translations[lang].serverError;
            } else if (error.message.includes('rate limit')) {
                return translations[lang].rateLimitExceeded;
            }
            
            return translations[lang].errorMessage;
        }

        function showError(message) {
            const errorContainer = document.getElementById('error-container');
            if (errorContainer) {
                errorContainer.textContent = message;
                errorContainer.style.display = 'block';
            }
        }

        function hideError() {
            const errorContainer = document.getElementById('error-container');
            if (errorContainer) {
                errorContainer.style.display = 'none';
            }
        }

        // Global function to switch language
        function switchLanguage(lang) {
            if (translations[lang]) {
                setCookie('lang', lang, 3);
                window.location.reload();
            }
        }