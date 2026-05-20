import {DisposableStore} from '@extensions/core/Lifecycle';
import type {PermissionManager} from '@extensions/core/ExtensionPermissions';
import type {
    ExtensionContext,
    ExtensionExports
} from '@extensions/core/ExtensionActivator';
import type {ExtensionDescriptor} from '@extensions/core/ExtensionsRegistry';
import {
    SandboxActivationResult,
    SandboxApiCallMessage,
    SandboxApiResponseMessage,
    SandboxCallbackInvokeMessage,
    SandboxCallbackResultMessage,
    SandboxExtensionContextData,
    SandboxMessage
} from './SandboxTypes';
import {createSandboxFrameHtml} from './SandboxFrameRuntime';
import {SandboxedExtensionApiHost} from './SandboxedExtensionApiHost';
import {deserializeError, serializeError} from './SandboxSerialization';

interface SandboxExtensionHostOptions {
    descriptor: ExtensionDescriptor;
    code: string;
    moduleVarName: string;
    context: ExtensionContext;
    storageSnapshots: {
        global: Record<string, unknown>;
        workspace: Record<string, unknown>;
    };
    permissionManager: PermissionManager | null;
}

type PendingRequest = {
    resolve(value: unknown): void;
    reject(error: Error): void;
};

export class SandboxExtensionHost {
    private readonly frame: HTMLIFrameElement;
    private readonly pendingRequests = new Map<string, PendingRequest>();
    private readonly apiHost: SandboxedExtensionApiHost;
    private readonly readyPromise: Promise<void>;
    private resolveReady!: () => void;
    private rejectReady!: (error: Error) => void;
    private requestIdSeed = 0;
    private disposed = false;
    private activated = false;

    constructor(private readonly options: SandboxExtensionHostOptions) {
        this.readyPromise = new Promise((resolve, reject) => {
            this.resolveReady = resolve;
            this.rejectReady = reject;
        });

        this.frame = this.createFrame();
        this.apiHost = new SandboxedExtensionApiHost({
            extensionId: options.descriptor.id,
            context: options.context,
            permissionManager: options.permissionManager,
            invokeRemoteCallback: (callbackId, args) => this.invokeRemoteCallback(callbackId, args)
        });

        window.addEventListener('message', this.handleMessage);
    }

    async initialize(): Promise<void> {
        await this.readyPromise;
        await this.request('sandbox:init', {
            code: this.options.code,
            moduleVarName: this.options.moduleVarName,
            context: this.createContextData()
        });
    }

    async activate(): Promise<SandboxActivationResult> {
        const result = await this.request('sandbox:activate', {});
        this.activated = true;
        return result as SandboxActivationResult;
    }

    async deactivate(): Promise<void> {
        if (!this.activated || this.disposed) {
            return;
        }

        await this.request('sandbox:deactivate', {});
        this.activated = false;
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        window.removeEventListener('message', this.handleMessage);
        this.apiHost.disposeAll();

        for (const pending of this.pendingRequests.values()) {
            pending.reject(new Error('Sandbox extension host disposed'));
        }
        this.pendingRequests.clear();

        this.frame.remove();
    }

    private createFrame(): HTMLIFrameElement {
        const frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.style.display = 'none';
        frame.onerror = () => this.rejectReady(new Error('Sandbox iframe failed to load'));
        frame.srcdoc = createSandboxFrameHtml();
        document.body.appendChild(frame);
        return frame;
    }

    private async request(type: 'sandbox:init' | 'sandbox:activate' | 'sandbox:deactivate', payload: Record<string, unknown>): Promise<unknown> {
        const requestId = this.nextRequestId();
        const message = {
            ...payload,
            type,
            requestId
        };

        this.postMessage(message);
        return await new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, {resolve, reject});
        });
    }

    private async invokeRemoteCallback(callbackId: string, args: unknown[]): Promise<unknown> {
        const requestId = this.nextRequestId();
        const message: SandboxCallbackInvokeMessage = {
            type: 'sandbox:callback-invoke',
            requestId,
            callbackId,
            args
        };

        this.postMessage(message);
        return await new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, {resolve, reject});
        });
    }

    private handleMessage = async (event: MessageEvent<SandboxMessage>): Promise<void> => {
        if (event.source !== this.frame.contentWindow) {
            return;
        }

        const message = event.data;
        if (!message || typeof message !== 'object') {
            return;
        }

        if (message.type === 'sandbox:ready') {
            this.resolveReady();
            return;
        }

        if (message.type === 'sandbox:api-response' || message.type === 'sandbox:callback-result') {
            this.handleResponse(message);
            return;
        }

        if (message.type === 'sandbox:api-call') {
            await this.handleApiCall(message);
        }
    };

    private handleResponse(message: SandboxApiResponseMessage | SandboxCallbackResultMessage): void {
        const pending = this.pendingRequests.get(message.requestId);
        if (!pending) {
            return;
        }

        this.pendingRequests.delete(message.requestId);
        if (message.success) {
            pending.resolve(message.value);
        } else {
            pending.reject(deserializeError(message.error));
        }
    }

    private async handleApiCall(message: SandboxApiCallMessage): Promise<void> {
        try {
            const value = await this.apiHost.call(message.apiPath, message.args);
            this.postMessage({
                type: 'sandbox:api-response',
                requestId: message.requestId,
                success: true,
                value
            });
        } catch (error) {
            this.postMessage({
                type: 'sandbox:api-response',
                requestId: message.requestId,
                success: false,
                error: serializeError(error).message
            });
        }
    }

    private postMessage(message: unknown): void {
        if (!this.frame.contentWindow) {
            throw new Error('Sandbox iframe is not ready');
        }

        this.frame.contentWindow.postMessage(message, '*');
    }

    private createContextData(): SandboxExtensionContextData {
        return {
            extension: this.options.context.extension,
            extensionId: this.options.context.extensionId,
            extensionPath: this.options.context.extensionPath,
            extensionUri: this.options.context.extensionUri,
            extensionMode: this.options.context.extensionMode,
            logPath: this.options.context.logPath,
            logUri: this.options.context.logUri,
            storagePath: this.options.context.storagePath,
            storageUri: this.options.context.storageUri,
            globalStoragePath: this.options.context.globalStoragePath,
            globalStorageUri: this.options.context.globalStorageUri,
            storageSnapshots: this.options.storageSnapshots
        };
    }

    private nextRequestId(): string {
        return `${this.options.descriptor.id}_${Date.now()}_${++this.requestIdSeed}`;
    }
}

export function createSandboxActivatedExtensionModule(host: SandboxExtensionHost): {
    activate(): Promise<ExtensionExports>;
    deactivate(): Promise<void>;
} {
    return {
        async activate() {
            const result = await host.activate();
            return result.exports;
        },
        async deactivate() {
            await host.deactivate();
            host.dispose();
        }
    };
}

export function createSandboxSubscription(host: SandboxExtensionHost): DisposableStore {
    const store = new DisposableStore();
    store.add(() => host.dispose());
    return store;
}
