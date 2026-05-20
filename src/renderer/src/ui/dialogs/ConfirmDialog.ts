import {Component} from "@ui/base/Component";

type ConfirmDialogType = 'default' | 'danger' | 'warning';

interface ConfirmDialogOptions {
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    type?: ConfirmDialogType;
    confirmButtonClass?: string;
    cancelButtonClass?: string;
}

class ConfirmDialog extends Component {
    private isVisible: boolean;
    private currentResolve: ((result: boolean) => void) | null;
    private listenersSetup: boolean;
    private overlay!: HTMLElement;
    private dialog!: HTMLElement;
    private titleElement!: HTMLElement;
    private messageElement!: HTMLElement;
    private closeBtn!: HTMLElement;
    private cancelBtn!: HTMLElement;
    private confirmBtn!: HTMLElement;

    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentResolve = null;
        this.listenersSetup = false;
    }

    show(options: string | ConfirmDialogOptions): Promise<boolean> {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }

        return new Promise((resolve) => {
            this.currentResolve = resolve;
            this.isVisible = true;

            const {
                title = '确认操作',
                message = '',
                confirmText = '确定',
                cancelText = '取消',
                type = 'default',
                confirmButtonClass = 'btn-primary',
                cancelButtonClass = 'btn-secondary'
            } = typeof options === 'string' ? {message: options} : options;

            this.titleElement.textContent = title;
            this.messageElement.textContent = message;
            this.confirmBtn.textContent = confirmText;
            this.cancelBtn.textContent = cancelText;

            this.confirmBtn.className = `btn ${confirmButtonClass}`;
            this.cancelBtn.className = `btn ${cancelButtonClass}`;

            this.dialog.className = 'modal-dialog';
            if (type === 'danger') {
                this.confirmBtn.className = 'btn btn-danger';
            } else if (type === 'warning') {
                this.confirmBtn.className = 'btn btn-warning';
            }

            this.overlay.style.display = 'flex';
            setTimeout(() => {
                this.confirmBtn.focus();
            }, 100);
        });
    }

    hide(result: boolean): void {
        this.isVisible = false;
        this.overlay.style.display = 'none';

        if (this.currentResolve) {
            this.currentResolve(result);
            this.currentResolve = null;
        }
    }

    setupElements(): void {
        this.overlay = document.getElementById('confirm-dialog') as HTMLElement;
        this.dialog = this.overlay.querySelector('.modal-dialog') as HTMLElement;
        this.titleElement = document.getElementById('confirm-dialog-title') as HTMLElement;
        this.messageElement = document.getElementById('confirm-dialog-message') as HTMLElement;
        this.closeBtn = document.getElementById('confirm-dialog-close') as HTMLElement;
        this.cancelBtn = document.getElementById('confirm-dialog-cancel') as HTMLElement;
        this.confirmBtn = document.getElementById('confirm-dialog-confirm') as HTMLElement;
    }

    setupEventListeners(): void {
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide(false));
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide(false));
        this.addEventListenerManaged(this.confirmBtn, 'click', () => this.hide(true));

        this.addEventListenerManaged(this.overlay, 'click', (e) => {
            if (e.target === this.overlay) {
                this.hide(false);
            }
        });

        this.addEventListenerManaged(document, 'keydown', (event) => {
            const e = event as KeyboardEvent;
            if (!this.isVisible) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                this.hide(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.hide(true);
            }
        });
    }
}

export {ConfirmDialog};
