import {defineConfig} from 'vitepress'

export default defineConfig({
    title: 'MusicBox',
    description: '高颜值、插件化、可深度定制的本地音乐播放器',
    lang: 'zh-CN',

    head: [
        ['link', {rel: 'icon', href: '/images/logo.svg'}],
        ['meta', {name: 'theme-color', content: '#646cff'}],
        ['meta', {name: 'og:type', content: 'website'}],
        ['meta', {name: 'og:locale', content: 'zh-CN'}],
        ['meta', {name: 'og:site_name', content: 'MusicBox'}],
        ['meta', {name: 'og:image', content: '/images/logo.svg'}],
    ],

    themeConfig: {
        logo: '/images/logo.svg',

        nav: [
            {text: '首页', link: '/'},
            {text: '架构', link: '/Architecture'},
            {text: '渲染进程', link: '/RendererArchitecture'},
            {text: '开发指南', link: '/Development'},
            {text: '更新日志', link: 'https://github.com/asxez/MusicBox/releases'}
        ],

        sidebar: [
            {
                text: '项目文档',
                items: [
                    {text: '总体架构', link: '/Architecture'},
                    {text: '渲染进程架构', link: '/RendererArchitecture'},
                    {text: '开发指南', link: '/Development'}
                ]
            }
        ],

        socialLinks: [
            {icon: 'github', link: 'https://github.com/asxez/MusicBox'}
        ],

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2025-2026 asxez'
        },

        search: {
            provider: 'local',
            options: {
                locales: {
                    root: {
                        translations: {
                            button: {
                                buttonText: '搜索文档',
                                buttonAriaLabel: '搜索文档'
                            },
                            modal: {
                                noResultsText: '无法找到相关结果',
                                resetButtonTitle: '清除查询条件',
                                footer: {
                                    selectText: '选择',
                                    navigateText: '切换'
                                }
                            }
                        }
                    }
                }
            }
        },

        docFooter: {
            prev: '上一页',
            next: '下一页'
        },

        outline: {
            label: '页面导航',
            level: [2, 3]
        },

        lastUpdated: {
            text: '最后更新于',
            formatOptions: {
                dateStyle: 'short',
                timeStyle: 'medium'
            }
        },

        returnToTopLabel: '返回顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式'
    }
})
