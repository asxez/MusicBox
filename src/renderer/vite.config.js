import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  // 根目录设置
  root: 'src',
  
  // 公共基础路径
  base: './',
  
  // 开发服务器配置
  server: {
    port: 8080,
    open: false,
    cors: true,
    // 禁用 HMR overlay，避免在 Electron 中出现问题
    hmr: {
      overlay: false
    }
  },
  
  // 构建配置
  build: {
    // 输出目录（相对于 root）
    outDir: '../public',
    // 清空输出目录
    emptyOutDir: true,
    // 生成 sourcemap
    sourcemap: false,
    // 代码分割阈值
    chunkSizeWarningLimit: 1000,
    // Rollup 配置
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/index.html'),
        'desktop-lyrics': path.resolve(__dirname, 'src/desktop-lyrics.html')
      },
      output: {
        // 静态资源输出配置
        assetFileNames: (assetInfo) => {
          // CSS 文件
          if (assetInfo.name.endsWith('.css')) {
            return 'styles/[name].[hash][extname]';
          }
          // 其他资源
          return 'assets/images/[name][extname]';
        },
        // JS 文件输出配置
        chunkFileNames: 'js/[name].[hash].js',
        entryFileNames: 'js/[name].[hash].js',
        
        // 手动代码分割
        manualChunks: (id) => {
          // 将 node_modules 中的依赖打包到 vendor
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('extensions/core') || id.includes('extensions/api')) {
            return 'extensions';
          }
          // 组件
          if (id.includes('components/')) {
            return 'components';
          }
        }
      }
    },
    // 压缩配置
    minify: 'esbuild',
    // 目标浏览器
    target: 'chrome138'
  },
  
  // 解析配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@js': path.resolve(__dirname, 'src/js'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@components': path.resolve(__dirname, 'src/js/components'),
      '@extensions': path.resolve(__dirname, 'src/js/extensions'),
    }
  },
  
  // CSS 配置
  css: {
    preprocessorOptions: {
      scss: {
        // 可以在这里添加全局 SCSS 变量
        // additionalData: `@import "@styles/variables.scss";`
      }
    }
  },
  
  // 插件配置
  plugins: [
    // 复制静态文件插件
    viteStaticCopy({
      targets: [
        // 复制内置插件
        {
          src: 'js/extensions/builtin',
          dest: 'js/extensions'
        },
        // 复制 favicon
        {
          src: 'favicon.svg',
          dest: '.'
        },
        {
          src: 'assets/images/favicon.ico',
          dest: './assets/images'
        }
      ]
    })
  ],
  
  // 优化依赖预构建
  optimizeDeps: {
    include: ['dayjs', 'fuse.js'],
    exclude: []
  }
});
