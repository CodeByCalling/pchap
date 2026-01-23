import { functions } from './firebase_config';
import { httpsCallable } from 'firebase/functions';

export class ChatWidget {
    private container: HTMLDivElement;
    private isOpen: boolean = false;
    private messages: { role: 'user' | 'model', text: string }[] = [];
    private isTyping: boolean = false;
    private language: 'english' | 'taglish' = 'taglish';

    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'smart-counselor-widget';
        this.init();
    }

    private init() {
        this.injectStyles();
        this.render();
        this.attachListeners();
        document.body.appendChild(this.container);
    }

    private injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #smart-counselor-widget {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                font-family: 'Inter', sans-serif;
            }
            .sc-launcher {
                width: 60px;
                height: 60px;
                background: var(--gold, #FFD700); /* HIGH CONTRAST BUTTON */
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: transform 0.2s;
                border: 2px solid white; /* distinctive ring */
            }
            .sc-launcher:hover {
                transform: scale(1.05);
            }
            .sc-launcher svg {
                width: 32px;
                height: 32px;
                fill: var(--royal-blue, #002366); /* Dark icon on Gold bg */
            }
            .sc-window {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 350px;
                height: 500px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.4); /* Stronger shadow */
                display: none;
                flex-direction: column;
                overflow: hidden;
                border: 3px solid var(--gold, #FFD700); /* DISTINCT BORDER */
            }
            .sc-window.open {
                display: flex;
                animation: slideIn 0.3s ease-out;
            }
            @keyframes slideIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .sc-header {
                background: var(--royal-blue, #002366);
                color: white;
                padding: 15px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 3px solid var(--gold, #FFD700);
            }
            .sc-header h3 {
                margin: 0;
                font-size: 1rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .sc-header-controls {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .sc-lang-select {
                background: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid rgba(255,255,255,0.4);
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                outline: none;
                cursor: pointer;
            }
            .sc-lang-select option {
                background: #fff;
                color: #333;
            }
            .sc-close {
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                opacity: 0.8;
                padding: 0;
            }
            .sc-disclaimer {
                background: #fff3cd;
                color: #856404;
                font-size: 0.75rem;
                padding: 8px 12px;
                text-align: center;
                border-bottom: 1px solid #ffeeba;
            }
            .sc-messages {
                flex: 1;
                padding: 15px;
                overflow-y: auto;
                background: #f8f9fa;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .sc-message {
                max-width: 80%;
                padding: 10px 14px;
                border-radius: 12px;
                font-size: 0.9rem;
                line-height: 1.4;
                word-wrap: break-word;
            }
            .sc-message.user {
                align-self: flex-end;
                background: var(--royal-blue, #002366);
                color: white;
                border-bottom-right-radius: 2px;
            }
            .sc-message.model {
                align-self: flex-start;
                background: white;
                border: 1px solid #ddd; /* clearer border */
                color: #333;
                border-bottom-left-radius: 2px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .sc-input-area {
                padding: 12px;
                background: white;
                border-top: 1px solid #eee;
                display: flex;
                gap: 8px;
            }
            .sc-input {
                flex: 1;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 20px;
                outline: none;
                font-size: 0.9rem;
            }
            .sc-input:focus {
                border-color: var(--royal-blue, #002366);
            }
            .sc-send {
                background: var(--royal-blue, #002366);
                color: white;
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            .sc-send:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            .typing-indicator span {
                display: inline-block;
                width: 6px;
                height: 6px;
                background: #ccc;
                border-radius: 50%;
                margin: 0 2px;
                animation: typing 1s infinite;
            }
            .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
            .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes typing {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
            }
            @media (max-width: 480px) {
                .sc-window {
                    width: calc(100vw - 40px);
                    bottom: 80px;
                    right: 0;
                    height: 60vh;
                }
            }
        `;
        document.head.appendChild(style);
    }

    private render() {
        this.container.innerHTML = `
            <div class="sc-window" id="sc-window">
                <div class="sc-header">
                    <h3>
                        <span style="font-size: 1.2rem;">🤖</span> 
                        Smart-Counselor
                    </h3>
                    <div class="sc-header-controls">
                        <select id="sc-lang-select" class="sc-lang-select">
                            <option value="taglish" ${this.language === 'taglish' ? 'selected' : ''}>Tagalog</option>
                            <option value="english" ${this.language === 'english' ? 'selected' : ''}>English</option>
                        </select>
                        <button class="sc-close">&times;</button>
                    </div>
                </div>
                <div class="sc-disclaimer">
                    ⚠️ Disclaimer: I am an AI assistant. My answers are based on policy but are NOT official approval.
                </div>
                <div class="sc-messages" id="sc-messages">
                    <div class="sc-message model">
                        ${this.language === 'taglish' 
                            ? 'Kumusta! Ako ang PCHAP Smart-Counselor. Paano ako makakatulong sa inyo ngayon?' 
                            : 'Hello! I am PCHAP\'s Smart-Counselor. How can I assist you with your membership or benefits questions today?'
                        }
                    </div>
                </div>
                <form class="sc-input-area" id="sc-form">
                    <input type="text" class="sc-input" placeholder="Type your question..." id="sc-input" autocomplete="off">
                    <button type="submit" class="sc-send" id="sc-send-btn">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </form>
            </div>
            <button class="sc-launcher" id="sc-launcher" aria-label="Open Chat">
                <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
            </button>
        `;
    }

    private attachListeners() {
        const launcher = this.container.querySelector('#sc-launcher') as HTMLButtonElement;
        const windowEl = this.container.querySelector('#sc-window') as HTMLDivElement;
        const closeBtn = this.container.querySelector('.sc-close') as HTMLButtonElement;
        const form = this.container.querySelector('#sc-form') as HTMLFormElement;
        const input = this.container.querySelector('#sc-input') as HTMLInputElement;
        const langSelect = this.container.querySelector('#sc-lang-select') as HTMLSelectElement;

        const toggle = () => {
            this.isOpen = !this.isOpen;
            if (this.isOpen) {
                windowEl.classList.add('open');
                input.focus();
            } else {
                windowEl.classList.remove('open');
            }
        };

        launcher.addEventListener('click', toggle);
        closeBtn.addEventListener('click', toggle);

        langSelect.addEventListener('change', (e) => {
             this.language = (e.target as HTMLSelectElement).value as 'english' | 'taglish';
             // Optimization: We could re-render messages or just clear them. 
             // For now, let's just clear and show the welcome message in the new language to indicate switch.
             this.container.querySelector('#sc-messages')!.innerHTML = `
                <div class="sc-message model">
                    ${this.language === 'taglish' 
                        ? 'Okay, nag-switch na tayo sa Taglish. Paano ako makakatulong?' 
                        : 'Switched to English. How can I help you?'}
                </div>
             `;
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text || this.isTyping) return;

            // Add user message
            this.addMessage('user', text);
            input.value = '';

            // Call Backend
            this.setTyping(true);
            try {
                const response = await this.callCloudFunction(text);
                this.addMessage('model', response);
            } catch (error: any) {
                // Get the specific error message if it exists, otherwise use a generic connection error
                const errorMessage = error.message || 'Unable to connect to Smart-Counselor.';
                const displayMessage = `⚠️ Error: ${errorMessage}`;
                
                this.addMessage('model', displayMessage);
                console.error('Smart-Counselor Error:', error);
            } finally {
                this.setTyping(false);
            }
        });
    }

    private addMessage(role: 'user' | 'model', text: string) {
        const messagesContainer = this.container.querySelector('#sc-messages')!;
        const msgDiv = document.createElement('div');
        msgDiv.className = `sc-message ${role}`;
        
        // Parse Markdown for Links and Bold
        // 1. Links: [text](url) -> <a href="url">text</a>
        // 2. Bold: **text** -> <strong>text</strong>
        let formattedText = text
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--royal-blue, #002366); text-decoration: underline; font-weight: 600;">$1</a>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        msgDiv.innerHTML = formattedText; 
        
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.messages.push({ role, text });
        if (this.messages.length > 20) this.messages.shift();
    }

    private setTyping(typing: boolean) {
        this.isTyping = typing;
        const messagesContainer = this.container.querySelector('#sc-messages')!;
        const sendBtn = this.container.querySelector('#sc-send-btn') as HTMLButtonElement;
        sendBtn.disabled = typing;

        if (typing) {
            const indicator = document.createElement('div');
            indicator.className = 'sc-message model typing-indicator';
            indicator.id = 'sc-typing';
            indicator.innerHTML = '<span></span><span></span><span></span>';
            messagesContainer.appendChild(indicator);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            const indicator = messagesContainer.querySelector('#sc-typing');
            if (indicator) indicator.remove();
        }
    }

    private async callCloudFunction(message: string): Promise<string> {
        const chatWithCounselor = httpsCallable(functions, 'chatWithCounselor');
        
        const geminiHistory = this.messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const pastHistory = geminiHistory.slice(0, -1);

        const result = await chatWithCounselor({ 
            message: message,
            history: pastHistory,
            language: this.language // Pass the selected language
        });
        
        const data = result.data as any;
        return data.answer;
    }
}
