const noop = () => {};

function getElectronAPI() {
    if (!window.electronAPI) {
        throw new Error('electronAPI is not available');
    }

    return window.electronAPI;
}

function getNamespace(name) {
    return getElectronAPI()[name];
}

function hasNamespace(name) {
    return Boolean(window.electronAPI && window.electronAPI[name]);
}

export class ElectronNamespaceAdapter {
    constructor(namespace) {
        this.namespace = namespace;
    }

    isAvailable() {
        return hasNamespace(this.namespace);
    }

    get api() {
        const namespaceAPI = getNamespace(this.namespace);
        if (!namespaceAPI) {
            throw new Error(`electronAPI.${this.namespace} is not available`);
        }

        return namespaceAPI;
    }

    call(method, ...args) {
        return this.api[method](...args);
    }

    on(method, handler) {
        if (!this.isAvailable() || typeof this.api[method] !== 'function') {
            return noop;
        }

        return this.api[method](handler) || noop;
    }
}

export {noop};

