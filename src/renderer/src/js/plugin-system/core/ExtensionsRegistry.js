/**
 * ExtensionsRegistry - 扩展注册表
 * 参考 VSCode 的扩展注册机制，管理扩展点和贡献点
 */

/**
 * 扩展点 - 定义扩展可以贡献的位置
 */
class ExtensionPoint {
    constructor(name) {
        this.name = name;
        this._handler = null;
        this._users = [];
        this._delta = null;
    }

    /**
     * 设置处理器
     * @param {Function} handler
     */
    setHandler(handler) {
        if (this._handler !== null) {
            console.warn(`⚠️ ExtensionPoint: ${this.name} 的处理器已设置`);
        }

        this._handler = handler;
        this._handle();

        return {
            dispose: () => {
                this._handler = null;
            }
        };
    }

    /**
     * 接受用户贡献
     * @param {Array} users
     */
    acceptUsers(users) {
        this._users = users;
        this._delta = {
            added: users,
            removed: []
        };
        this._handle();
    }

    /**
     * 处理贡献
     */
    _handle() {
        if (this._handler === null || this._users.length === 0) {
            return;
        }

        try {
            this._handler(this._users, this._delta);
        } catch (error) {
            console.error(`❌ ExtensionPoint: 处理 ${this.name} 时出错:`, error);
        }
    }

    /**
     * 获取所有用户
     */
    getUsers() {
        return [...this._users];
    }
}

/**
 * 扩展描述符 - 描述一个扩展的元数据
 */
class ExtensionDescriptor {
    constructor(manifest) {
        this.id = manifest.id;
        this.name = manifest.name;
        this.version = manifest.version;
        this.description = manifest.description || '';
        this.author = manifest.author || '';
        this.main = manifest.main;
        this.activationEvents = manifest.activationEvents || [];
        this.contributes = manifest.contributes || {};
        this.engines = manifest.engines || {};
        this.categories = manifest.categories || [];
        this.keywords = manifest.keywords || [];
        this.extensionLocation = manifest.extensionLocation || '';
        this.isBuiltin = manifest.isBuiltin || false;
        this.enabledApiProposals = manifest.enabledApiProposals || [];
        // canDisable: 是否允许被禁用（仅对内置扩展有效，外部扩展始终可禁用）
        // 默认值：内置扩展默认不可禁用(false)，外部扩展始终可禁用(true)
        this.canDisable = this.isBuiltin ? (manifest.canDisable === true) : true;
        // 启用状态：内置扩展默认启用，第三方扩展从配置读取（默认启用）
        this.enabled = manifest.enabled !== undefined ? manifest.enabled : true;
    }

    /**
     * 检查是否在激活事件中
     * @param {String} activationEvent
     */
    isActivationEvent(activationEvent) {
        return this.activationEvents.includes(activationEvent) ||
            this.activationEvents.includes('*');
    }

    /**
     * 获取贡献点
     * @param {String} contributionPoint
     */
    getContribution(contributionPoint) {
        return this.contributes[contributionPoint];
    }
}

/**
 * 扩展注册表
 */
class ExtensionsRegistry {
    constructor() {
        this._extensionPoints = new Map();
        this._extensions = new Map();
        this._activationEvents = new Map();
    }

    /**
     * 注册扩展点
     * @param {String} name 扩展点名称
     * @param {Object} descriptor 扩展点描述符
     */
    registerExtensionPoint(name, descriptor = {}) {
        if (this._extensionPoints.has(name)) {
            console.warn(`⚠️ ExtensionsRegistry: 扩展点 ${name} 已注册`);
            return this._extensionPoints.get(name);
        }

        const extensionPoint = new ExtensionPoint(name);
        this._extensionPoints.set(name, extensionPoint);

        console.log(`✅ ExtensionsRegistry: 注册扩展点 ${name}`);

        return extensionPoint;
    }

    /**
     * 获取扩展点
     * @param {String} name
     */
    getExtensionPoint(name) {
        return this._extensionPoints.get(name);
    }

    /**
     * 注册扩展
     * @param {ExtensionDescriptor} descriptor
     */
    registerExtension(descriptor) {
        if (this._extensions.has(descriptor.id)) {
            console.warn(`⚠️ ExtensionsRegistry: 扩展 ${descriptor.id} 已注册`);
            return;
        }

        this._extensions.set(descriptor.id, descriptor);

        // 注册激活事件
        for (const activationEvent of descriptor.activationEvents) {
            if (!this._activationEvents.has(activationEvent)) {
                this._activationEvents.set(activationEvent, []);
            }
            this._activationEvents.get(activationEvent).push(descriptor);
        }

        // 处理贡献点
        this._processContributions(descriptor);

        console.log(`✅ ExtensionsRegistry: 注册扩展 ${descriptor.id}`);
    }

    /**
     * 处理扩展的贡献点
     * @param {ExtensionDescriptor} descriptor
     */
    _processContributions(descriptor) {
        for (const [contributionPoint, contribution] of Object.entries(descriptor.contributes)) {
            const extensionPoint = this._extensionPoints.get(contributionPoint);

            if (extensionPoint) {
                const users = extensionPoint.getUsers();
                users.push({
                    description: descriptor,
                    value: contribution
                });
                extensionPoint.acceptUsers(users);
            } else {
                console.warn(`⚠️ ExtensionsRegistry: 未找到扩展点 ${contributionPoint}`);
            }
        }
    }

    /**
     * 获取扩展
     * @param {String} id
     */
    getExtension(id) {
        return this._extensions.get(id);
    }

    /**
     * 获取所有扩展
     */
    getAllExtensions() {
        return Array.from(this._extensions.values());
    }

    /**
     * 根据激活事件获取扩展
     * @param {String} activationEvent
     */
    getExtensionsByActivationEvent(activationEvent) {
        return this._activationEvents.get(activationEvent) || [];
    }

    /**
     * 检查是否包含激活事件
     * @param {String} activationEvent
     */
    containsActivationEvent(activationEvent) {
        return this._activationEvents.has(activationEvent);
    }

    /**
     * 注销扩展
     * @param {String} id
     */
    unregisterExtension(id) {
        const descriptor = this._extensions.get(id);
        if (!descriptor) {
            return;
        }

        this._extensions.delete(id);

        // 移除激活事件
        for (const activationEvent of descriptor.activationEvents) {
            const extensions = this._activationEvents.get(activationEvent);
            if (extensions) {
                const index = extensions.indexOf(descriptor);
                if (index > -1) {
                    extensions.splice(index, 1);
                }
                if (extensions.length === 0) {
                    this._activationEvents.delete(activationEvent);
                }
            }
        }

        console.log(`✅ ExtensionsRegistry: 注销扩展 ${id}`);
    }

    /**
     * 清空所有扩展
     */
    clear() {
        this._extensions.clear();
        this._activationEvents.clear();
    }
}

/**
 * 激活事件类型
 */
const ActivationEvents = {
    // 启动时激活
    ON_START_UP: 'onStartUp',

    // 命令激活
    ON_COMMAND: 'onCommand',

    // 视图激活
    ON_VIEW: 'onView',

    // 语言激活
    ON_LANGUAGE: 'onLanguage',

    // 文件系统激活
    ON_FILE_SYSTEM: 'onFileSystem',

    // 自定义激活
    ON_CUSTOM: 'onCustom',

    // 通配符 - 总是激活
    WILDCARD: '*'
};

/**
 * 贡献点类型
 */
const ContributionPoints = {
    // 命令贡献
    COMMANDS: 'commands',

    // 菜单贡献
    MENUS: 'menus',

    // 视图贡献
    VIEWS: 'views',

    // 配置贡献
    CONFIGURATION: 'configuration',

    // 主题贡献
    THEMES: 'themes',

    // 图标贡献
    ICONS: 'icons',

    // 语言贡献
    LANGUAGES: 'languages',

    // 快捷键贡献
    KEYBINDINGS: 'keybindings'
};

// 创建全局注册表实例
const extensionsRegistry = new ExtensionsRegistry();

export {
    ExtensionPoint,
    ExtensionDescriptor,
    ExtensionsRegistry,
    ActivationEvents,
    ContributionPoints,
    extensionsRegistry,
};
