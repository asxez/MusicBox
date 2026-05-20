/**
 * 输入对话框工具类
 */

class InputDialog {
    private modal: HTMLElement | null;
    private title: HTMLElement | null;
    private message: HTMLElement | null;
    private input: HTMLInputElement | null;
    private confirmBtn: HTMLElement | null;
    private cancelBtn: HTMLElement | null;
    private closeBtn: HTMLElement | null;
    private resolveCallback: ((value: string | null) => void) | null;

    constructor() {
        this.modal = null;
        this.title = null;
        this.message = null;
        this.input = null;
        this.confirmBtn = null;
        this.cancelBtn = null;
        this.closeBtn = null;
        this.resolveCallback = null;

        this.init();
    }

    init(): void {
        this.modal = document.getElementById('input-dialog-modal');
        this.title = document.getElementById('input-dialog-title');
        this.message = document.getElementById('input-dialog-message');
        this.input = document.getElementById('input-dialog-input') as HTMLInputElement | null;
        this.confirmBtn = document.getElementById('input-dialog-confirm');
        this.cancelBtn = document.getElementById('input-dialog-cancel');
        this.closeBtn = document.getElementById('input-dialog-close');

        this.setupEventListeners();
    }

    setupEventListeners(): void {
        if (!this.modal || !this.input || !this.confirmBtn || !this.cancelBtn || !this.closeBtn) {
            return;
        }

        this.confirmBtn.addEventListener('click', () => this.confirm());
        this.cancelBtn.addEventListener('click', () => this.cancel());
        this.closeBtn.addEventListener('click', () => this.cancel());

        // 点击遮罩关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.cancel();
            }
        });

        // Enter键确认，Escape键取消
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.confirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancel();
            }
        });
    }

    /**
     * 显示输入对话框
     * @param {string} message - 提示消息
     * @param {string} defaultValue - 默认值
     * @param {string} title - 对话框标题
     * @returns {Promise<string|null>} 返回输入的值，取消时返回null
     */
    show(message: string, defaultValue = '', title = '输入'): Promise<string | null> {
        return new Promise((resolve, reject) => {
            if (!this.modal || !this.title || !this.message || !this.input) {
                resolve(null);
                return;
            }

            this.resolveCallback = resolve;
            void reject;
            const input = this.input;

            this.title.textContent = title;
            this.message.textContent = message;
            this.input.value = defaultValue;

            this.modal.style.display = 'flex';
            setTimeout(() => {
                input.focus();
                input.select();
            }, 100);
        });
    }

    confirm(): void {
        if (!this.input) return;
        const value = this.input.value.trim();
        this.hide();

        if (this.resolveCallback) {
            this.resolveCallback(value || null);
            this.resolveCallback = null;
        }
    }

    cancel(): void {
        this.hide();

        if (this.resolveCallback) {
            this.resolveCallback(null);
            this.resolveCallback = null;
        }
    }

    hide(): void {
        if (!this.modal || !this.input) return;
        this.modal.style.display = 'none';
        this.input.value = '';
    }
}

// 创建全局单例
let inputDialogInstance: InputDialog | null = null;

/**
 * 显示输入对话框
 * @param {string} message - 提示消息
 * @param {string} defaultValue - 默认值
 * @param {string} title - 对话框标题
 * @returns {Promise<string|null>} 返回输入的值，取消时返回null
 */
export function showInputDialog(message: string, defaultValue = '', title = '输入'): Promise<string | null> {
    if (!inputDialogInstance) {
        inputDialogInstance = new InputDialog();
    }
    return inputDialogInstance.show(message, defaultValue, title);
}

export default InputDialog;
