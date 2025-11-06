/**
 * Instantiation - 依赖注入系统
 * 参考 VSCode 的依赖注入机制，提供服务注册和自动注入
 */

/**
 * 服务标识符
 */
class ServiceIdentifier {
    constructor(id) {
        this._id = id;
    }

    toString() {
        return this._id;
    }
}

/**
 * 创建服务装饰器
 * @param {String} serviceId 服务ID
 * @returns {ServiceIdentifier}
 */
function createDecorator(serviceId) {
    const decorator = new ServiceIdentifier(serviceId);

    // 存储服务ID映射
    if (!ServiceIdentifier._serviceIds) {
        ServiceIdentifier._serviceIds = new Map();
    }
    ServiceIdentifier._serviceIds.set(serviceId, decorator);

    return decorator;
}

/**
 * 服务描述符
 */
class SyncDescriptor {
    constructor(ctor, staticArguments = [], supportsDelayedInstantiation = false) {
        this.ctor = ctor;
        this.staticArguments = staticArguments;
        this.supportsDelayedInstantiation = supportsDelayedInstantiation;
    }
}

/**
 * 服务集合
 */
class ServiceCollection {
    constructor(...entries) {
        this._entries = new Map();

        for (const [id, service] of entries) {
            this.set(id, service);
        }
    }

    /**
     * 设置服务
     * @param {ServiceIdentifier} id
     * @param {*} instanceOrDescriptor
     */
    set(id, instanceOrDescriptor) {
        const result = this._entries.get(id);
        this._entries.set(id, instanceOrDescriptor);
        return result;
    }

    /**
     * 检查是否存在服务
     * @param {ServiceIdentifier} id
     */
    has(id) {
        return this._entries.has(id);
    }

    /**
     * 获取服务
     * @param {ServiceIdentifier} id
     */
    get(id) {
        return this._entries.get(id);
    }

    /**
     * 删除服务
     * @param {ServiceIdentifier} id
     */
    delete(id) {
        return this._entries.delete(id);
    }

    /**
     * 遍历所有服务
     */
    forEach(callback, thisArg) {
        this._entries.forEach(callback, thisArg);
    }
}

/**
 * 实例化服务
 */
class InstantiationService {
    constructor(services = new ServiceCollection(), strict = false, parent = null) {
        this._services = services;
        this._strict = strict;
        this._parent = parent;
        this._isDisposed = false;
        this._servicesToMaybeDispose = new Set();

        // 注册自身
        this._services.set(IInstantiationService, this);
    }

    /**
     * 创建子容器
     * @param {ServiceCollection} services
     */
    createChild(services) {
        return new InstantiationService(services, this._strict, this);
    }

    /**
     * 调用函数并注入服务
     * @param {Function} fn
     * @param  {...any} args
     */
    invokeFunction(fn, ...args) {
        if (this._isDisposed) {
            throw new Error('InstantiationService 已被释放');
        }

        const accessor = {
            get: (id) => {
                if (this._isDisposed) {
                    throw new Error('InstantiationService 已被释放');
                }
                return this._getOrCreateServiceInstance(id);
            }
        };

        return fn(accessor, ...args);
    }

    /**
     * 创建实例
     * @param {Function|SyncDescriptor} ctorOrDescriptor
     * @param  {...any} rest
     */
    createInstance(ctorOrDescriptor, ...rest) {
        if (this._isDisposed) {
            throw new Error('InstantiationService 已被释放');
        }

        let ctor, args;

        if (ctorOrDescriptor instanceof SyncDescriptor) {
            ctor = ctorOrDescriptor.ctor;
            args = [...ctorOrDescriptor.staticArguments, ...rest];
        } else {
            ctor = ctorOrDescriptor;
            args = rest;
        }

        return this._createInstance(ctor, args);
    }

    /**
     * 内部创建实例方法
     * @param {Function} ctor
     * @param {Array} args
     */
    _createInstance(ctor, args = []) {
        // 获取服务依赖
        const serviceDependencies = this._getServiceDependencies(ctor);
        const serviceArgs = [];

        for (const dependency of serviceDependencies) {
            const service = this._getOrCreateServiceInstance(dependency.id);
            if (!service && this._strict) {
                throw new Error(`[createInstance] ${ctor.name} 依赖未知服务 ${dependency.id}`);
            }
            serviceArgs.push(service);
        }

        // 合并参数
        const allArgs = [...args, ...serviceArgs];

        // 创建实例
        return new ctor(...allArgs);
    }

    /**
     * 获取或创建服务实例
     * @param {ServiceIdentifier} id
     */
    _getOrCreateServiceInstance(id) {
        const thing = this._getServiceInstanceOrDescriptor(id);

        if (thing instanceof SyncDescriptor) {
            return this._createAndCacheServiceInstance(id, thing);
        } else {
            return thing;
        }
    }

    /**
     * 获取服务实例或描述符
     * @param {ServiceIdentifier} id
     */
    _getServiceInstanceOrDescriptor(id) {
        const instanceOrDesc = this._services.get(id);
        if (instanceOrDesc !== undefined) {
            return instanceOrDesc;
        }

        // 尝试从父容器获取
        if (this._parent) {
            return this._parent._getServiceInstanceOrDescriptor(id);
        }

        return undefined;
    }

    /**
     * 创建并缓存服务实例
     * @param {ServiceIdentifier} id
     * @param {SyncDescriptor} desc
     */
    _createAndCacheServiceInstance(id, desc) {
        const instance = this._createServiceInstance(id, desc.ctor, desc.staticArguments);
        this._services.set(id, instance);
        this._servicesToMaybeDispose.add(instance);
        return instance;
    }

    /**
     * 创建服务实例
     * @param {ServiceIdentifier} id
     * @param {Function} ctor
     * @param {Array} args
     */
    _createServiceInstance(id, ctor, args = []) {
        return this._createInstance(ctor, args);
    }

    /**
     * 获取构造函数的服务依赖
     * @param {Function} ctor
     */
    _getServiceDependencies(ctor) {
        // 检查构造函数是否有服务依赖标记
        if (ctor.$di$dependencies) {
            return ctor.$di$dependencies;
        }
        return [];
    }

    /**
     * 释放资源
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        this._isDisposed = true;

        // 释放所有可能需要释放的服务
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

/**
 * 标记服务依赖
 * @param {ServiceIdentifier} id
 * @param {Function} target
 * @param {Number} index
 */
function storeServiceDependency(id, target, index) {
    if (!target.$di$dependencies) {
        target.$di$dependencies = [];
    }
    target.$di$dependencies.push({id, index});
}

/**
 * 服务注册表
 */
const ServiceRegistry = {
    _services: new Map(),

    /**
     * 注册单例服务
     * @param {ServiceIdentifier} id
     * @param {Function|SyncDescriptor} ctorOrDescriptor
     */
    registerSingleton(id, ctorOrDescriptor) {
        if (this._services.has(id)) {
            console.warn(`⚠️ ServiceRegistry: 服务 ${id} 已注册`);
            return;
        }

        let descriptor;
        if (ctorOrDescriptor instanceof SyncDescriptor) {
            descriptor = ctorOrDescriptor;
        } else {
            descriptor = new SyncDescriptor(ctorOrDescriptor);
        }

        this._services.set(id, descriptor);
    },

    /**
     * 获取所有服务
     */
    getServices() {
        return new Map(this._services);
    }
};

// 预定义的服务标识符
const IInstantiationService = createDecorator('instantiationService');

export {
    ServiceIdentifier,
    createDecorator,
    SyncDescriptor,
    ServiceCollection,
    InstantiationService,
    storeServiceDependency,
    ServiceRegistry,
    IInstantiationService,
};
