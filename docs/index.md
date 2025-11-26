---
layout: home

hero:
  name: "MusicBox"
  text: "高颜值、插件化、可深度定制的本地音乐播放器"
  tagline: "A visually stunning, plugin-based, and highly customizable local music player."
  image:
    src: /images/logo.svg
    alt: MusicBox
  actions:
    - theme: brand
      text: 立即下载
      link: https://github.com/asxez/MusicBox/releases
    - theme: alt
      text: 在 GitHub 上查看
      link: https://github.com/asxez/MusicBox

features:
  - icon: 💻
    title: 跨平台支持
    details: 支持 Windows、macOS 和 Linux 三大主流操作系统，一次开发，处处运行

  - icon: ✅
    title: 多格式支持
    details: 支持 FLAC、MP3、WAV、OGG、M4A、AAC、WMA 等多种主流音乐格式

  - icon: 🔧
    title: 强大的插件系统
    details: 允许在插件中实现任何功能，高权限插件系统让你的播放器无限可能
    
  - icon: 🎶
    title: WASAPI 音频独占模式
    details: 支持音频独占，享受至高音乐效果
    
  - icon: 📄
    title: 逐字歌词
    details: 支持 TTML 格式歌词，欣赏歌词被逐一填充的乐趣
    
  - icon: 🤏 
    title: 迷你播放器
    details: 一键切换迷你模式，小小的也很可爱

  - icon: 📔
    title: 在线获取歌词封面
    details: 支持在线获取歌曲封面和歌词，也支持识别内嵌封面和内嵌歌词

  - icon: ⌨️
    title: 自定义快捷键
    details: 支持自定义局内/全局快捷键，让操作更加便捷高效

  - icon: 🎈
    title: 主题切换
    details: 浅色/深色主题自由切换，适应不同使用场景和个人喜好

  - icon: 🎼
    title: 图形/参量均衡器支持
    details: 内置超强均衡器，体验极致自定义音效，轻松打造专属听觉体验

  - icon: 📃
    title: 桌面歌词
    details: 支持桌面显示歌词，让你在工作时也能跟着节奏哼唱

  - icon: 💾
    title: 网络磁盘支持
    details: 支持挂载 SMB/WebDAV 等网络磁盘，随时随地访问你的音乐库

  - icon: 🖋️
    title: 元数据编辑
    details: 支持编辑歌曲元数据，让你的音乐库井井有条

  - icon: ▶️
    title: 无间隙播放
    details: 支持无间隙播放，为连续的专辑歌曲提供更好的播放体验

  - icon: ⚙️
    title: 高度个性化的设置功能
    details: 内置多个设置项，打造属于你的个性化播放器
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #667eea50 50%, #764ba250 50%);
  --vp-home-hero-image-filter: blur(44px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}
</style>

## 应用截图

<div class="screenshots">
  <img src="/images/1.png" alt="MusicBox 截图 1" />
  <img src="/images/2.png" alt="MusicBox 截图 2" />
  <img src="/images/3.png" alt="MusicBox 截图 3" />
  <img src="/images/4.png" alt="MusicBox 截图 4" />
  <img src="/images/5.png" alt="MusicBox 截图 5" />
  <img src="/images/6.png" alt="MusicBox 截图 6" />
</div>

<style scoped>
.screenshots {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.screenshots img {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.screenshots img:hover {
  transform: scale(1.05);
}
</style>

---

<div style="text-align: center; margin-top: 3rem;">
  <p style="font-size: 1.2rem; font-weight: 600;">
    如果你喜欢这个项目，请给它一个 ⭐️
  </p>
  <a href="https://github.com/asxez/MusicBox" target="_blank" style="display: inline-block;">
    <img src="https://img.shields.io/github/stars/asxez/MusicBox?style=social" alt="GitHub stars">
  </a>
</div>
