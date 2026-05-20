import type {ExtensionContext, ExtensionExports} from '@extensions/core/ExtensionActivator';

export type SandboxMessage =
    | SandboxInitMessage
    | SandboxActivateMessage
    | SandboxDeactivateMessage
    | SandboxReadyMessage
    | SandboxApiResponseMessage
    | SandboxApiCallMessage
    | SandboxCallbackInvokeMessage
    | SandboxCallbackResultMessage;

export interface SandboxInitMessage {
    type: 'sandbox:init';
    code: string;
    moduleVarName: string;
    context: SandboxExtensionContextData;
}

export interface SandboxActivateMessage {
    type: 'sandbox:activate';
    requestId: string;
}

export interface SandboxDeactivateMessage {
    type: 'sandbox:deactivate';
    requestId: string;
}

export interface SandboxReadyMessage {
    type: 'sandbox:ready';
}

export interface SandboxApiCallMessage {
    type: 'sandbox:api-call';
    requestId: string;
    apiPath: string;
    args: unknown[];
}

export interface SandboxApiResponseMessage {
    type: 'sandbox:api-response';
    requestId: string;
    success: boolean;
    value?: unknown;
    error?: string;
}

export interface SandboxCallbackInvokeMessage {
    type: 'sandbox:callback-invoke';
    requestId: string;
    callbackId: string;
    args: unknown[];
}

export interface SandboxCallbackResultMessage {
    type: 'sandbox:callback-result';
    requestId: string;
    success: boolean;
    value?: unknown;
    error?: string;
}

export interface SerializedCallback {
    __musicboxType: 'callback';
    callbackId: string;
}

export interface SerializedDisposable {
    __musicboxType: 'disposable';
    disposableId: string;
}

export interface SerializedError {
    message: string;
    name?: string;
    stack?: string;
}

export type SandboxExtensionContextData = Pick<
    ExtensionContext,
    | 'extension'
    | 'extensionId'
    | 'extensionPath'
    | 'extensionUri'
    | 'extensionMode'
    | 'logPath'
    | 'logUri'
    | 'storagePath'
    | 'storageUri'
    | 'globalStoragePath'
    | 'globalStorageUri'
> & {
    storageSnapshots: {
        global: Record<string, unknown>;
        workspace: Record<string, unknown>;
    };
};

export interface SandboxActivationResult {
    exports: ExtensionExports;
}

export function isSerializedCallback(value: unknown): value is SerializedCallback {
    return isSerializedRecord(value) &&
        value.__musicboxType === 'callback' &&
        typeof value.callbackId === 'string';
}

export function isSerializedDisposable(value: unknown): value is SerializedDisposable {
    return isSerializedRecord(value) &&
        value.__musicboxType === 'disposable' &&
        typeof value.disposableId === 'string';
}

function isSerializedRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object';
}
