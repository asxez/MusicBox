/**
 * Extensions Core - 核心模块导出
 */

export * from './Lifecycle';
export * from './Event';
export * from './Instantiation';
export * from './ExtensionsRegistry';
export * from './ExtensionActivator';
export * from './ExtensionService';
export * from './ExtensionPermissions';
export * from './ExtensionConfiguration';
export * from './ExtensionDependencies';
export * from './ExtensionAPIProxy';

export type {
    AppReadyEventDetail,
    ExtensionInfo,
    MusicBoxAPI,
    MusicBoxApp,
    MusicBoxPluginHost
} from './types';
