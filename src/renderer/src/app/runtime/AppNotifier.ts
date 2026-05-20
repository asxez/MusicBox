import {showToast} from '@utils/index.js';

interface FatalErrorView {
    showFatalError(message: string): void;
}

export class AppNotifier {
    constructor(private readonly fatalErrorView: FatalErrorView) {}

    showSuccess(message: string): void {
        showToast(message, 'success');
    }

    showError(message: string): void {
        showToast(message, 'error');
    }

    showFatalError(message: string): void {
        this.fatalErrorView.showFatalError(message);
        this.showError(message);
    }

    showInfo(message: string): void {
        showToast(message, 'info');
    }
}
