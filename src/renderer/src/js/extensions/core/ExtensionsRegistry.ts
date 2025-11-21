/**
 * ExtensionsRegistry - 扩展注册表
 * 参考 VSCode 的扩展注册机制，管理扩展点和贡献点
 */

import {IDisposable} from '@extensions/core/Lifecycle';

interface ExtensionPointUser<T> {
    description: ExtensionDescriptor;
    value: T;
}

interface ExtensionPointDelta<T> {
    added: ExtensionPointUser<T>[];
    removed: ExtensionPointUser<T>[];
}

export class ExtensionPoint<T = any> {
    readonly name: string;
    private _handler: ((users: ExtensionPointUser<T>[], delta: ExtensionPointDelta<T>) => void) | null = null;
    private _users: ExtensionPointUser<T>[] = [];
    private _delta: ExtensionPointDelta<T> | null = null;

    constructor(name: string) {
        this.name = name;
    }

    setHandler(handler: (users: ExtensionPointUser<T>[], delta: ExtensionPointDelta<T>) => void): IDisposable {
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

    acceptUsers(users: ExtensionPointUser<T>[]): void {
        this._users = users;
        this._delta = {
            added: users,
            removed: []
        };
        this._handle();
    }

    private _handle(): void {
        if (this._handler === null || this._users.length === 0) {
            return;
        }

        try {
            this._handler(this._users, this._delta!);
        } catch (error) {
            console.error(`❌ ExtensionPoint: 处理 ${this.name} 时出错:`, error);
        }
    }

    getUsers(): ExtensionPointUser<T>[] {
        return [...this._users];
    }
}

export interface ExtensionManifest {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    main?: string;
    activationEvents?: string[];
    contributes?: Record<string, any>;
    engines?: Record<string, string>;
    categories?: string[];
    keywords?: string[];
    extensionLocation?: string;
    isBuiltin?: boolean;
    enabledApiProposals?: string[];
    canDisable?: boolean;
    enabledByDefault?: boolean;
    enabled?: boolean;
    publisher?: string;
    extensionDependencies?: string[];
    permissions?: string[];
}

export class ExtensionDescriptor {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly description: string;
    readonly author: string;
    readonly main?: string;
    readonly activationEvents: string[];
    readonly contributes: Record<string, any>;
    readonly engines: Record<string, string>;
    readonly categories: string[];
    readonly keywords: string[];
    readonly extensionLocation: string;
    readonly isBuiltin: boolean;
    readonly enabledApiProposals: string[];
    readonly canDisable: boolean;
    readonly enabledByDefault: boolean;
    readonly extensionDependencies: string[];
    enabled: boolean;
    readonly publisher?: string;

    constructor(manifest: ExtensionManifest) {
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
        this.canDisable = this.isBuiltin ? (manifest.canDisable === true) : true;
        this.enabledByDefault = this.isBuiltin ? (manifest.enabledByDefault !== false) : true;
        this.extensionDependencies = manifest.extensionDependencies || [];
        this.enabled = manifest.enabled !== undefined ? manifest.enabled : this.enabledByDefault;
        this.publisher = manifest.publisher;
    }

    isActivationEvent(activationEvent: string): boolean {
        return this.activationEvents.includes(activationEvent) ||
            this.activationEvents.includes('*');
    }

    getContribution(contributionPoint: string): any {
        return this.contributes[contributionPoint];
    }
}

export class ExtensionsRegistry {
    private _extensionPoints = new Map<string, ExtensionPoint>();
    private _extensions = new Map<string, ExtensionDescriptor>();
    private _activationEvents = new Map<string, ExtensionDescriptor[]>();

    registerExtensionPoint<T = any>(name: string, _descriptor: any = {}): ExtensionPoint<T> {
        if (this._extensionPoints.has(name)) {
            console.warn(`⚠️ ExtensionsRegistry: 扩展点 ${name} 已注册`);
            return this._extensionPoints.get(name)!;
        }

        const extensionPoint = new ExtensionPoint<T>(name);
        this._extensionPoints.set(name, extensionPoint);

        console.log(`✅ ExtensionsRegistry: 注册扩展点 ${name}`);

        return extensionPoint;
    }

    getExtensionPoint(name: string): ExtensionPoint | undefined {
        return this._extensionPoints.get(name);
    }

    registerExtension(descriptor: ExtensionDescriptor): void {
        if (this._extensions.has(descriptor.id)) {
            console.warn(`⚠️ ExtensionsRegistry: 扩展 ${descriptor.id} 已注册`);
            return;
        }

        this._extensions.set(descriptor.id, descriptor);

        for (const activationEvent of descriptor.activationEvents) {
            if (!this._activationEvents.has(activationEvent)) {
                this._activationEvents.set(activationEvent, []);
            }
            this._activationEvents.get(activationEvent)!.push(descriptor);
        }

        this._processContributions(descriptor);

        console.log(`✅ ExtensionsRegistry: 注册扩展 ${descriptor.id}`);
    }

    private _processContributions(descriptor: ExtensionDescriptor): void {
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

    getExtension(id: string): ExtensionDescriptor | undefined {
        return this._extensions.get(id);
    }

    getAllExtensions(): ExtensionDescriptor[] {
        return Array.from(this._extensions.values());
    }

    getExtensionsByActivationEvent(activationEvent: string): ExtensionDescriptor[] {
        return this._activationEvents.get(activationEvent) || [];
    }

    containsActivationEvent(activationEvent: string): boolean {
        return this._activationEvents.has(activationEvent);
    }

    unregisterExtension(id: string): void {
        const descriptor = this._extensions.get(id);
        if (!descriptor) {
            return;
        }

        this._extensions.delete(id);

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

    clear(): void {
        this._extensions.clear();
        this._activationEvents.clear();
    }
}

export const ActivationEvents = {
    ON_START_UP: 'onStartUp',
    ON_COMMAND: 'onCommand',
    ON_VIEW: 'onView',
    ON_LANGUAGE: 'onLanguage',
    ON_FILE_SYSTEM: 'onFileSystem',
    ON_CUSTOM: 'onCustom',
    WILDCARD: '*'
} as const;

export const ContributionPoints = {
    COMMANDS: 'commands',
    MENUS: 'menus',
    VIEWS: 'views',
    CONFIGURATION: 'configuration',
    THEMES: 'themes',
    ICONS: 'icons',
    LANGUAGES: 'languages',
    KEYBINDINGS: 'keybindings'
} as const;

export const extensionsRegistry = new ExtensionsRegistry();
