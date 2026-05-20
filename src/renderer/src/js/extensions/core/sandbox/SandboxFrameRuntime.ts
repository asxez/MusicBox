const SANDBOX_RUNTIME_SCRIPT = String.raw`
(function() {
    const callbacks = new Map();
    const pendingApiCalls = new Map();
    let callbackIdSeed = 0;
    let requestIdSeed = 0;
    let activeModule = null;
    let activeInstance = null;
    let activeExports = null;
    let contextData = null;
    let activeContext = null;

    window.addEventListener('message', async (event) => {
        const message = event.data;
        if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
            return;
        }

        try {
            if (message.type === 'sandbox:init') {
                await handleInit(message);
                postResponse(message.requestId, true);
                return;
            }

            if (message.type === 'sandbox:activate') {
                await handleActivate(message);
                return;
            }

            if (message.type === 'sandbox:deactivate') {
                await handleDeactivate(message);
                return;
            }

            if (message.type === 'sandbox:api-response') {
                handleApiResponse(message);
                return;
            }

            if (message.type === 'sandbox:callback-invoke') {
                await handleCallbackInvoke(message);
            }
        } catch (error) {
            postResponse(message.requestId, false, undefined, serializeError(error));
        }
    });

    parent.postMessage({type: 'sandbox:ready'}, '*');

    async function handleInit(message) {
        contextData = message.context;
        const fakeWindow = Object.create(null);
        fakeWindow.console = console;
        fakeWindow.setTimeout = setTimeout.bind(window);
        fakeWindow.clearTimeout = clearTimeout.bind(window);
        fakeWindow.setInterval = setInterval.bind(window);
        fakeWindow.clearInterval = clearInterval.bind(window);

        const context = createContext(message.context);
        fakeWindow.createExtensionAPI = () => context.api;

        const runner = new Function(
            'window',
            'self',
            'globalThis',
            'document',
            'localStorage',
            'sessionStorage',
            'indexedDB',
            'navigator',
            'location',
            'createExtensionAPI',
            'console',
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
            'resolveExtensionModule',
            '"use strict";\n' + message.code + '\n;return resolveExtensionModule(window, globalThis, ' + JSON.stringify(message.moduleVarName) + ');'
        );

        activeModule = runner(
            fakeWindow,
            fakeWindow,
            fakeWindow,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            fakeWindow.createExtensionAPI,
            console,
            fakeWindow.setTimeout,
            fakeWindow.clearTimeout,
            fakeWindow.setInterval,
            fakeWindow.clearInterval,
            resolveExtensionModule
        );

        if (!activeModule || typeof activeModule !== 'object') {
            throw new Error('外部插件没有导出有效模块');
        }
    }

    function resolveExtensionModule(windowObject, globalObject, moduleVarName) {
        if (moduleVarName && typeof moduleVarName === 'string') {
            return windowObject[moduleVarName] || globalObject[moduleVarName] || null;
        }

        if (windowObject.musicboxExtension || globalObject.musicboxExtension) {
            return windowObject.musicboxExtension || globalObject.musicboxExtension;
        }

        const candidates = [];
        collectExtensionModuleCandidates(candidates, windowObject);
        if (globalObject !== windowObject) {
            collectExtensionModuleCandidates(candidates, globalObject);
        }

        if (candidates.length === 1) {
            return candidates[0];
        }

        return null;
    }

    function collectExtensionModuleCandidates(candidates, container) {
        for (const key of Object.keys(container)) {
            const value = container[key];
            if (!value || typeof value !== 'object') {
                continue;
            }

            if (typeof value.activate === 'function' || typeof value.default === 'function') {
                candidates.push(value);
            }
        }
    }

    async function handleActivate(message) {
        const context = createContext(contextData);
        activeContext = context;
        let exports = null;

        if (activeModule && typeof activeModule.activate === 'function') {
            exports = await activeModule.activate(context);
        } else if (activeModule && typeof activeModule.default === 'function') {
            activeInstance = new activeModule.default(context);
            if (activeInstance && typeof activeInstance.activate === 'function') {
                await activeInstance.activate();
            }
            exports = activeInstance;
        }

        activeExports = sanitizeExports(exports);
        postResponse(message.requestId, true, {exports: activeExports});
    }

    async function handleDeactivate(message) {
        if (activeModule && typeof activeModule.deactivate === 'function') {
            await activeModule.deactivate();
        } else if (activeInstance && typeof activeInstance.deactivate === 'function') {
            await activeInstance.deactivate();
        }

        if (activeContext && activeContext.subscriptions) {
            activeContext.subscriptions.dispose();
        }

        callbacks.clear();
        activeModule = null;
        activeInstance = null;
        activeExports = null;
        activeContext = null;
        postResponse(message.requestId, true);
    }

    function handleApiResponse(message) {
        const pending = pendingApiCalls.get(message.requestId);
        if (!pending) {
            return;
        }

        pendingApiCalls.delete(message.requestId);
        if (message.success) {
            pending.resolve(deserializeRemoteValue(message.value));
        } else {
            pending.reject(deserializeError(message.error));
        }
    }

    async function handleCallbackInvoke(message) {
        const callback = callbacks.get(message.callbackId);
        if (!callback) {
            postCallbackResult(message.requestId, false, undefined, {message: 'Unknown callback'});
            return;
        }

        try {
            const result = await callback(...message.args.map(deserializeRemoteValue));
            postCallbackResult(message.requestId, true, serializeLocalValue(result));
        } catch (error) {
            postCallbackResult(message.requestId, false, undefined, serializeError(error));
        }
    }

    function createContext(data) {
        return {
            ...data,
            subscriptions: createSubscriptionStore(),
            globalState: createMemento('global'),
            workspaceState: createMemento('workspace'),
            environmentVariableCollection: null,
            api: createRemoteApi('')
        };
    }

    function createSubscriptionStore() {
        const disposables = new Set();
        return {
            add(disposable) {
                if (disposable) {
                    disposables.add(disposable);
                }
                return disposable;
            },
            delete(disposable) {
                if (!disposables.has(disposable)) {
                    return;
                }
                disposables.delete(disposable);
                disposeValue(disposable);
            },
            clear() {
                disposables.clear();
            },
            dispose() {
                for (const disposable of disposables) {
                    disposeValue(disposable);
                }
                disposables.clear();
            }
        };
    }

    function createMemento(scope) {
        const state = {
            ...((contextData && contextData.storageSnapshots && contextData.storageSnapshots[scope]) || {})
        };

        return {
            get(key, defaultValue) {
                return state[key] !== undefined ? state[key] : defaultValue;
            },
            async update(key, value) {
                if (typeof value === 'undefined') {
                    delete state[key];
                } else {
                    state[key] = value;
                }

                await callApi('storage.' + (scope === 'global' ? 'update' : 'updateWorkspace'), [key, value]);
            },
            keys() {
                return Object.keys(state);
            }
        };
    }

    function createRemoteApi(prefix) {
        return new Proxy(Object.create(null), {
            get(_target, prop) {
                if (typeof prop === 'symbol') {
                    return undefined;
                }

                const path = prefix ? prefix + '.' + prop : prop;
                return createCallableProxy(path);
            }
        });
    }

    function createCallableProxy(path) {
        const fn = (...args) => callApi(path, args);
        return new Proxy(fn, {
            get(_target, prop) {
                if (typeof prop === 'symbol') {
                    return undefined;
                }
                return createCallableProxy(path + '.' + prop);
            },
            apply(_target, _thisArg, args) {
                return callApi(path, args);
            }
        });
    }

    function callApi(apiPath, args) {
        const requestId = nextRequestId();
        parent.postMessage({
            type: 'sandbox:api-call',
            requestId,
            apiPath,
            args: args.map(serializeLocalValue)
        }, '*');

        return new Promise((resolve, reject) => {
            pendingApiCalls.set(requestId, {resolve, reject});
        });
    }

    function serializeLocalValue(value) {
        if (typeof value === 'function') {
            const callbackId = 'callback_' + Date.now() + '_' + (++callbackIdSeed);
            callbacks.set(callbackId, value);
            return {
                __musicboxType: 'callback',
                callbackId
            };
        }

        if (Array.isArray(value)) {
            return value.map(serializeLocalValue);
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            result[key] = serializeLocalValue(entry);
        }
        return result;
    }

    function deserializeRemoteValue(value) {
        if (isSerializedDisposable(value)) {
            return {
                dispose() {
                    return callApi('sandbox.dispose', [value.disposableId]);
                }
            };
        }

        if (Array.isArray(value)) {
            return value.map(deserializeRemoteValue);
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            result[key] = deserializeRemoteValue(entry);
        }
        return result;
    }

    function sanitizeExports(value) {
        if (!value || typeof value !== 'object') {
            return value ?? null;
        }

        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            if (typeof entry !== 'function') {
                result[key] = serializeLocalValue(entry);
            }
        }
        return result;
    }

    function disposeValue(value) {
        if (value && typeof value.dispose === 'function') {
            value.dispose();
        } else if (typeof value === 'function') {
            value();
        }
    }

    function postResponse(requestId, success, value, error) {
        if (!requestId) {
            return;
        }

        parent.postMessage({
            type: 'sandbox:api-response',
            requestId,
            success,
            value,
            error
        }, '*');
    }

    function postCallbackResult(requestId, success, value, error) {
        if (!requestId) {
            return;
        }

        parent.postMessage({
            type: 'sandbox:callback-result',
            requestId,
            success,
            value,
            error
        }, '*');
    }

    function nextRequestId() {
        return 'request_' + Date.now() + '_' + (++requestIdSeed);
    }

    function isSerializedDisposable(value) {
        return !!value && typeof value === 'object' &&
            value.__musicboxType === 'disposable' &&
            typeof value.disposableId === 'string';
    }

    function serializeError(error) {
        if (error instanceof Error) {
            return {
                message: error.message,
                name: error.name,
                stack: error.stack
            };
        }
        return {message: String(error)};
    }

    function deserializeError(error) {
        if (!error) {
            return new Error('Unknown sandbox error');
        }
        const result = new Error(error.message || String(error));
        result.name = error.name || 'Error';
        result.stack = error.stack;
        return result;
    }
})();
`;

export function createSandboxFrameHtml(): string {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src 'none'; style-src 'none'; worker-src 'none'; child-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
</head>
<body>
<script>${SANDBOX_RUNTIME_SCRIPT.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>`;
}
