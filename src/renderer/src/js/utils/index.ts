/**
 * Format time in seconds to MM:SS or HH:MM:SS format
 */
function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

/**
 * Debounce function to limit the rate of function calls
 */
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return function executedFunction(...args: Parameters<T>): void {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Sanitize string for use in HTML
 */
function sanitizeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Show toast notification
 */
type ToastType = 'success' | 'error' | 'info' | 'warning';

function showToast(message: string, type: ToastType = 'info', duration = 1500): void {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add toast styles if not already added
    if (!document.querySelector('#toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-size: 14px;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
            }
            .toast-success { background: #10b981; }
            .toast-error { background: #ef4444; }
            .toast-warning { background: #f59e0b; }
            .toast-info { background: #3b82f6; }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// 自定义事件
type EventCallback = (...args: any[]) => void;

class EventEmitter {
    private readonly events: Record<string, EventCallback[]>;

    constructor() {
        this.events = {};
    }

    on(event: string, callback: EventCallback): void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event: string, callback: EventCallback): void {
        if (!this.events[event]) return;

        const index = this.events[event].indexOf(callback);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
    }

    emit(event: string, ...args: any[]): void {
        if (!this.events[event]) return;

        this.events[event].forEach((callback) => {
            try {
                callback(...args);
            } catch (error) {
                console.error('Error in event callback:', error);
            }
        });
    }

    removeAllListeners(eventName?: string): void {
        if (!eventName) {
            Object.keys(this.events).forEach((event) => {
                delete this.events[event];
            });
            return;
        }

        if (this.events[eventName]) {
            delete this.events[eventName];
        }
    }
}

const themeEvents = new EventEmitter();

interface ThemeController {
    readonly current: string;
    set(themeName: string | null): void;
    toggle(): void;
    init(): void;
    on(event: string, callback: EventCallback): void;
    off(event: string, callback: EventCallback): void;
    emit(event: string, ...args: any[]): void;
}

const theme: ThemeController = {
    get current() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    },

    set(themeName: string | null): void {
        const normalizedTheme = String(themeName);
        document.documentElement.setAttribute('data-theme', normalizedTheme);
        localStorage.setItem('theme', normalizedTheme);
        this.emit('change', themeName);
    },

    toggle(): void {
        this.set(this.current === 'light' ? 'dark' : 'light');
    },

    init(): void {
        const savedTheme = localStorage.getItem('theme');
        this.set(savedTheme);
        console.log("☁️ 主题初始化：", savedTheme);
    },

    on: themeEvents.on.bind(themeEvents),
    off: themeEvents.off.bind(themeEvents),
    emit: themeEvents.emit.bind(themeEvents)
};

document.addEventListener('DOMContentLoaded', () => {
    theme.init();
});


export {
    EventEmitter,
    showToast,
    debounce,
    theme,
    formatTime,
    sanitizeHTML,
};
