import {Component} from "@components/base/Component";

class ConfirmDialog extends Component {
    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentResolve = null;
        this.listenersSetup = false;
    }

    show(options) {
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

    hide(result) {
        this.isVisible = false;
        this.overlay.style.display = 'none';

        if (this.currentResolve) {
            this.currentResolve(result);
            this.currentResolve = null;
        }
    }

    setupElements() {
        this.overlay = document.getElementById('confirm-dialog');
        this.dialog = this.overlay.querySelector('.modal-dialog');
        this.titleElement = document.getElementById('confirm-dialog-title');
        this.messageElement = document.getElementById('confirm-dialog-message');
        this.closeBtn = document.getElementById('confirm-dialog-close');
        this.cancelBtn = document.getElementById('confirm-dialog-cancel');
        this.confirmBtn = document.getElementById('confirm-dialog-confirm');
    }

    setupEventListeners() {
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide(false));
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide(false));
        this.addEventListenerManaged(this.confirmBtn, 'click', () => this.hide(true));

        this.addEventListenerManaged(this.overlay, 'click', (e) => {
            if (e.target === this.overlay) {
                this.hide(false);
            }
        });

        this.addEventListenerManaged(document, 'keydown', (e) => {
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
