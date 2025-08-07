class Component extends EventEmitter {
    constructor(element) {
        super();
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.isDestroyed = false;

        if (!this.element) {
            console.error('Component element not found');
            return;
        }

        this.init();
    }

    init() {
        // 子类实现
    }

    destroy() {
        this.isDestroyed = true;
        this.removeAllListeners();
    }

    removeAllListeners() {
        this.events = {};
    }
}

window.Component = Component;
