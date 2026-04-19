/**
 * 依赖注入容器
 * 管理服务的注册、实例化和生命周期
 */

export type ServiceFactory<T = any> = () => T | Promise<T>;

/**
 * 服务优先级
 */
export enum ServicePriority {
    CRITICAL = 0,    // 关键服务（窗口创建前必须初始化）
    HIGH = 1,        // 高优先级（窗口显示后立即初始化）
    NORMAL = 2,      // 普通优先级（按需初始化）
    LOW = 3          // 低优先级（后台初始化）
}

/**
 * 服务元数据
 */
interface ServiceMetadata {
    factory: ServiceFactory;
    singleton: boolean;
    priority: ServicePriority;
    lazy: boolean;  // 是否延迟实例化
}

/**
 * 服务容器类
 */
export class ServiceContainer {
    private services = new Map<string, any>();
    private metadata = new Map<string, ServiceMetadata>();
    private initializationPromises = new Map<string, Promise<any>>();

    /**
     * 注册服务工厂
     * @param name - 服务名称
     * @param factory - 服务工厂函数
     * @param options - 服务选项
     */
    register<T>(
        name: string,
        factory: ServiceFactory<T>,
        options: {
            singleton?: boolean;
            priority?: ServicePriority;
            lazy?: boolean;
        } = {}
    ): void {
        const {
            singleton = true,
            priority = ServicePriority.NORMAL,
            lazy = true
        } = options;

        if (this.metadata.has(name)) {
            console.warn(`⚠️ 服务 ${name} 已存在，将被覆盖`);
        }

        this.metadata.set(name, {
            factory,
            singleton,
            priority,
            lazy
        });
    }

    /**
     * 获取服务实例
     * @param name - 服务名称
     * @returns 服务实例
     */
    async get<T>(name: string): Promise<T> {
        const meta = this.metadata.get(name);
        if (!meta) {
            throw new Error(`❌ 服务未注册: ${name}`);
        }

        // 如果是单例且已实例化，直接返回
        if (meta.singleton && this.services.has(name)) {
            return this.services.get(name);
        }

        // 如果正在初始化，等待初始化完成
        if (this.initializationPromises.has(name)) {
            return this.initializationPromises.get(name)!;
        }

        // 创建实例
        const initPromise = this.createInstance<T>(name, meta);
        if (meta.singleton) {
            this.initializationPromises.set(name, initPromise);
        }

        try {
            const instance = await initPromise;
            if (meta.singleton) {
                this.services.set(name, instance);
                this.initializationPromises.delete(name);
            }
            return instance;
        } catch (error) {
            this.initializationPromises.delete(name);
            throw new Error(`❌ 创建服务失败 ${name}: ${(error as Error).message}`);
        }
    }

    private async createInstance<T>(_name: string, meta: ServiceMetadata): Promise<T> {
        try {
            return await meta.factory();
        } catch (error) {
            throw error;
        }
    }

    /**
     * 同步获取服务实例（仅用于已实例化的单例）
     * @param name - 服务名称
     * @returns 服务实例
     */
    getSync<T>(name: string): T {
        if (!this.services.has(name)) {
            throw new Error(`❌ 服务未实例化: ${name}`);
        }
        return this.services.get(name);
    }

    /**
     * 检查服务是否已注册
     * @param name - 服务名称
     * @returns 是否已注册
     */
    has(name: string): boolean {
        return this.metadata.has(name);
    }

    /**
     * 检查服务是否已实例化
     * @param name - 服务名称
     * @returns 是否已实例化
     */
    isInstantiated(name: string): boolean {
        return this.services.has(name);
    }

    /**
     * 移除服务
     * @param name - 服务名称
     */
    remove(name: string): void {
        this.metadata.delete(name);
        this.services.delete(name);
        this.initializationPromises.delete(name);
    }

    /**
     * 清空所有服务
     */
    clear(): void {
        this.metadata.clear();
        this.services.clear();
        this.initializationPromises.clear();
    }

    /**
     * 获取所有已注册的服务名称
     */
    getRegisteredServices(): string[] {
        return Array.from(this.metadata.keys());
    }

    /**
     * 获取所有已实例化的服务名称
     */
    getInstantiatedServices(): string[] {
        return Array.from(this.services.keys());
    }

    /**
     * 按优先级预初始化服务
     * @param priority - 优先级阈值
     */
    async preInitializeByPriority(priority: ServicePriority): Promise<void> {
        const servicesToInit = Array.from(this.metadata.entries())
            .filter(([_, meta]) => meta.priority <= priority && !meta.lazy)
            .map(([name]) => name);

        if (servicesToInit.length === 0) return;

        console.log(`🔄 预初始化 ${servicesToInit.length} 个优先级 ≤ ${priority} 的服务...`);
        await Promise.allSettled(servicesToInit.map(name => this.get(name)));
    }

    /**
     * 获取容器统计信息
     */
    getStats(): {
        registered: number;
        instantiated: number;
        initializing: number;
    } {
        return {
            registered: this.metadata.size,
            instantiated: this.services.size,
            initializing: this.initializationPromises.size
        };
    }
}
