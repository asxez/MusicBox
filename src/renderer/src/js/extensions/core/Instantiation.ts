/**
 * Instantiation - 依赖注入系统
 * 参考 VSCode 的依赖注入机制，提供服务注册和自动注入
 */

export class ServiceIdentifier<T> {
    readonly _serviceBrand: T;
    private _id: string;

    constructor(id: string) {
        this._id = id;
        this._serviceBrand = undefined!;
    }

    toString(): string {
        return this._id;
    }
}

export function createDecorator<T>(serviceId: string): ServiceIdentifier<T> {
    const decorator = new ServiceIdentifier<T>(serviceId);

    if (!(ServiceIdentifier as any)._serviceIds) {
        (ServiceIdentifier as any)._serviceIds = new Map();
    }
    (ServiceIdentifier as any)._serviceIds.set(serviceId, decorator);

    return decorator;
}

export class SyncDescriptor<T> {
    readonly ctor: new (...args: any[]) => T;
    readonly staticArguments: any[];
    readonly supportsDelayedInstantiation: boolean;

    constructor(ctor: new (...args: any[]) => T, staticArguments: any[] = [], supportsDelayedInstantiation = false) {
        this.ctor = ctor;
        this.staticArguments = staticArguments;
        this.supportsDelayedInstantiation = supportsDelayedInstantiation;
    }
}

export class ServiceCollection {
    private _entries = new Map<ServiceIdentifier<any>, any>();

    constructor(...entries: [ServiceIdentifier<any>, any][]) {
        for (const [id, service] of entries) {
            this.set(id, service);
        }
    }

    set<T>(id: ServiceIdentifier<T>, instanceOrDescriptor: T | SyncDescriptor<T>): T | SyncDescriptor<T> | undefined {
        const result = this._entries.get(id);
        this._entries.set(id, instanceOrDescriptor);
        return result;
    }

    has(id: ServiceIdentifier<any>): boolean {
        return this._entries.has(id);
    }

    get<T>(id: ServiceIdentifier<T>): T | SyncDescriptor<T> | undefined {
        return this._entries.get(id);
    }

    delete(id: ServiceIdentifier<any>): boolean {
        return this._entries.delete(id);
    }

    forEach(callback: (value: any, key: ServiceIdentifier<any>) => void, thisArg?: any): void {
        this._entries.forEach(callback, thisArg);
    }
}

export interface ServicesAccessor {
    get<T>(id: ServiceIdentifier<T>): T;
}

interface ServiceDependency {
    id: ServiceIdentifier<any>;
    index: number;
}

export class InstantiationService {
    private _services: ServiceCollection;
    private _strict: boolean;
    private _parent: InstantiationService | null;
    private _isDisposed = false;
    private _servicesToMaybeDispose = new Set<any>();

    constructor(services = new ServiceCollection(), strict = false, parent: InstantiationService | null = null) {
        this._services = services;
        this._strict = strict;
        this._parent = parent;

        this._services.set(IInstantiationService, this);
    }

    createChild(services: ServiceCollection): InstantiationService {
        return new InstantiationService(services, this._strict, this);
    }

    invokeFunction<R>(fn: (accessor: ServicesAccessor, ...args: any[]) => R, ...args: any[]): R {
        if (this._isDisposed) {
            throw new Error('InstantiationService 已被释放');
        }

        const accessor: ServicesAccessor = {
            get: <T>(id: ServiceIdentifier<T>): T => {
                if (this._isDisposed) {
                    throw new Error('InstantiationService 已被释放');
                }
                const service = this._getOrCreateServiceInstance(id);
                if (!service) {
                    throw new Error(`服务 ${id} 未找到`);
                }
                return service;
            }
        };

        return fn(accessor, ...args);
    }

    createInstance<T>(ctor: new (...args: any[]) => T, ...rest: any[]): T;
    createInstance<T>(descriptor: SyncDescriptor<T>, ...rest: any[]): T;
    createInstance<T>(ctorOrDescriptor: (new (...args: any[]) => T) | SyncDescriptor<T>, ...rest: any[]): T {
        if (this._isDisposed) {
            throw new Error('InstantiationService 已被释放');
        }

        let ctor: new (...args: any[]) => T;
        let args: any[];

        if (ctorOrDescriptor instanceof SyncDescriptor) {
            ctor = ctorOrDescriptor.ctor;
            args = [...ctorOrDescriptor.staticArguments, ...rest];
        } else {
            ctor = ctorOrDescriptor;
            args = rest;
        }

        return this._createInstance(ctor, args);
    }

    private _createInstance<T>(ctor: new (...args: any[]) => T, args: any[] = []): T {
        const serviceDependencies = this._getServiceDependencies(ctor);
        const serviceArgs: any[] = [];

        for (const dependency of serviceDependencies) {
            const service = this._getOrCreateServiceInstance(dependency.id);
            if (!service && this._strict) {
                throw new Error(`[createInstance] ${ctor.name} 依赖未知服务 ${dependency.id}`);
            }
            serviceArgs.push(service);
        }

        const allArgs = [...args, ...serviceArgs];

        return new ctor(...allArgs);
    }

    private _getOrCreateServiceInstance<T>(id: ServiceIdentifier<T>): T | undefined {
        const thing = this._getServiceInstanceOrDescriptor(id);

        if (thing instanceof SyncDescriptor) {
            return this._createAndCacheServiceInstance(id, thing);
        } else {
            return thing;
        }
    }

    private _getServiceInstanceOrDescriptor<T>(id: ServiceIdentifier<T>): T | SyncDescriptor<T> | undefined {
        const instanceOrDesc = this._services.get(id);
        if (instanceOrDesc !== undefined) {
            return instanceOrDesc;
        }

        if (this._parent) {
            return this._parent._getServiceInstanceOrDescriptor(id);
        }

        return undefined;
    }

    private _createAndCacheServiceInstance<T>(id: ServiceIdentifier<T>, desc: SyncDescriptor<T>): T {
        const instance = this._createServiceInstance(id, desc.ctor, desc.staticArguments);
        this._services.set(id, instance);
        this._servicesToMaybeDispose.add(instance);
        return instance;
    }

    private _createServiceInstance<T>(_id: ServiceIdentifier<T>, ctor: new (...args: any[]) => T, args: any[] = []): T {
        return this._createInstance(ctor, args);
    }

    private _getServiceDependencies(ctor: any): ServiceDependency[] {
        if (ctor.$di$dependencies) {
            return ctor.$di$dependencies;
        }
        return [];
    }

    dispose(): void {
        if (this._isDisposed) {
            return;
        }

        this._isDisposed = true;

        for (const instance of this._servicesToMaybeDispose) {
            if (instance && typeof instance.dispose === 'function') {
                try {
                    instance.dispose();
                } catch (error) {
                    console.error('❌ InstantiationService: 释放服务时出错:', error);
                }
            }
        }

        this._servicesToMaybeDispose.clear();
    }
}

export function storeServiceDependency(id: ServiceIdentifier<any>, target: any, index: number): void {
    if (!target.$di$dependencies) {
        target.$di$dependencies = [];
    }
    target.$di$dependencies.push({id, index});
}

class ServiceRegistryImpl {
    _services = new Map<ServiceIdentifier<any>, SyncDescriptor<any>>();

    registerSingleton<T>(id: ServiceIdentifier<T>, ctor: new (...args: any[]) => T): void;
    registerSingleton<T>(id: ServiceIdentifier<T>, descriptor: SyncDescriptor<T>): void;
    registerSingleton<T>(id: ServiceIdentifier<T>, ctorOrDescriptor: (new (...args: any[]) => T) | SyncDescriptor<T>): void {
        if (this._services.has(id)) {
            console.warn(`⚠️ ServiceRegistry: 服务 ${id} 已注册`);
            return;
        }

        let descriptor: SyncDescriptor<T>;
        if (ctorOrDescriptor instanceof SyncDescriptor) {
            descriptor = ctorOrDescriptor;
        } else {
            descriptor = new SyncDescriptor(ctorOrDescriptor);
        }

        this._services.set(id, descriptor);
    }

    getServices(): Map<ServiceIdentifier<any>, SyncDescriptor<any>> {
        return new Map(this._services);
    }
}

export const ServiceRegistry = new ServiceRegistryImpl();
export const IInstantiationService = createDecorator<InstantiationService>('instantiationService');
