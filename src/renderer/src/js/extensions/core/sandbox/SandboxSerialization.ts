import {
    isSerializedCallback,
    isSerializedDisposable,
    SerializedCallback,
    SerializedDisposable,
    SerializedError
} from './SandboxTypes';

type CallbackRegistry = Map<string, (...args: unknown[]) => unknown>;
type DisposableInvoker = (disposableId: string) => Promise<void>;

export class SandboxValueSerializer {
    private callbackIdSeed = 0;

    constructor(private readonly callbacks: CallbackRegistry) {}

    serialize(value: unknown): unknown {
        if (typeof value === 'function') {
            return this.serializeCallback(value as (...args: unknown[]) => unknown);
        }

        if (Array.isArray(value)) {
            return value.map(item => this.serialize(item));
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        return this.serializeObject(value as Record<string, unknown>);
    }

    private serializeCallback(callback: (...args: unknown[]) => unknown): SerializedCallback {
        const callbackId = `callback_${Date.now()}_${++this.callbackIdSeed}`;
        this.callbacks.set(callbackId, callback);
        return {
            __musicboxType: 'callback',
            callbackId
        };
    }

    private serializeObject(value: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const [key, entry] of Object.entries(value)) {
            result[key] = this.serialize(entry);
        }

        return result;
    }
}

export class SandboxValueDeserializer {
    constructor(private readonly disposeRemote: DisposableInvoker) {}

    deserialize(value: unknown): unknown {
        if (isSerializedDisposable(value)) {
            return this.deserializeDisposable(value);
        }

        if (Array.isArray(value)) {
            return value.map(item => this.deserialize(item));
        }

        if (!value || typeof value !== 'object' || isSerializedCallback(value)) {
            return value;
        }

        const result: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            result[key] = this.deserialize(entry);
        }

        return result;
    }

    private deserializeDisposable(value: SerializedDisposable): {dispose(): Promise<void>} {
        return {
            dispose: () => this.disposeRemote(value.disposableId)
        };
    }
}

export function serializeError(error: unknown): SerializedError {
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack: error.stack
        };
    }

    return {
        message: String(error)
    };
}

export function deserializeError(error: string | SerializedError | undefined): Error {
    if (!error) {
        return new Error('Unknown sandbox error');
    }

    if (typeof error === 'string') {
        return new Error(error);
    }

    const result = new Error(error.message);
    result.name = error.name || 'Error';
    result.stack = error.stack;
    return result;
}
