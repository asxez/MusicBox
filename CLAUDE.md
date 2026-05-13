# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

There’s a file modification bug in Claude Code. The workaround is: always use complete absolute Windows paths with drive letters and backslashes for ALL file operations. Apply this rule going forward, not just for this file.

## CRITICAL: File Editing on Windows

### ⚠️ MANDATORY: Always Use Backslashes on Windows for File Paths

**When using Edit or MultiEdit tools on Windows, you MUST use backslashes (`\`) in file paths, NOT forward slashes (`/`).**

#### ❌ WRONG - Will cause errors:
```
Edit(file_path: "D:/repos/project/file.tsx", ...)
MultiEdit(file_path: "D:/repos/project/file.tsx", ...)
```

#### ✅ CORRECT - Always works:
```
Edit(file_path: "D:\repos\project\file.tsx", ...)
MultiEdit(file_path: "D:\repos\project\file.tsx", ...)
```

## Project Overview

MusicBox is a plugin-based local music player built with Electron. It supports multiple audio formats (flac, mp3, wav, ogg, m4a, aac, wma) and features a plugin system inspired by VSCode's extension architecture.

## Technology Stack

- **Main Process**: Electron (v37.3.1) with TypeScript, Node.js (≥22.18.0)
- **Renderer Process**: Vite + vanilla JavaScript (TypeScript for extension system only)
- **Native Audio**: Rust (v1.94.1) with WASAPI exclusive mode support, built via napi-rs
- **Python**: Used for metadata editing utilities (≥3.8), compiled to `.exe` via PyInstaller
- **Styling**: SCSS

## Development Commands

```bash
# Install all dependencies
npm install && npm run install:renderer && npm run install:rs
pip install -r requirements.txt

# Development (builds renderer + Rust + TypeScript, then launches Electron with --expose-gc)
npm run dev

# Build renderer only (for UI iteration)
npm run dev:renderer    # Vite dev server on port 8080

# Build TypeScript (main process) only
npm run build:ts        # Compiles src/main/**/*.ts to dist/main/
npm run watch:ts        # Watch mode for TypeScript compilation

# Build Rust native module only
npm run build:rs

# Build Python metadata editor only
npm run build:python    # Compiles metadata_editor.py to .exe via PyInstaller

# Full application build
npm run build

# Platform-specific builds
npm run build:win       # Windows (NSIS + portable)
npm run build:mac       # macOS (DMG + ZIP)
npm run build:linux     # Linux (AppImage + deb + rpm)

# Lint renderer code
cd src/renderer && npm run lint

# Clean build artifacts
npm run clean
```

Note: `npm run dev` is NOT hot-reload — it runs a full `build:renderer` + `build:rs` + `build:ts` before launching Electron via `dev:main`. For fast UI iteration, use `dev:renderer` separately.

## Architecture

### Multi-Process Structure

```
Main Process (Node.js + TypeScript)   ↔ IPC ↔   Renderer Process (Chromium)
├── Application class (core/Application.ts)      ├── UI (Vite + vanilla JS)
├── Controllers (IPC handlers via decorators)    ├── Plugin system (TypeScript)
├── Services (library, network, extensions)      ├── Pages & components
├── WindowManager & ConfigManager                └── Desktop lyrics window
└── Native audio engine (Rust N-API)
```

### Main Process (`src/main/`)

**Architecture Pattern**: Controller-based with dependency injection

- **`main.ts`**: Entry point — creates `Application` instance and manages app lifecycle
- **`core/Application.ts`**: Central orchestrator — initializes services, registers controllers, manages startup
- **`core/ServiceContainer.ts`**: Dependency injection container for services
- **`core/WindowManager.ts`**: Window creation and management
- **`core/ConfigManager.ts`**: Configuration file management
- **`preload.ts`**: Preload script bridging main/renderer via contextBridge
- **`controllers/`**: IPC handlers using `@IpcHandler` decorator pattern
  - Each controller handles a specific domain (Audio, Library, Network, Settings, etc.)
  - Controllers are auto-registered via `BaseController` and decorator metadata
- **`services/`**: Business logic
  - `library/`: LibraryCacheManager, MetadataHandler, AutoScanScheduler
  - `network/`: NetworkDriveManager, NetworkFileAdapter, DriveRegistry
  - `extensions/`: ExtensionInstaller
- **`decorators/IpcHandler.ts`**: Decorator for automatic IPC handler registration
- **`utils/`**: Utility functions (metadata parsing, path security, file search)

### Renderer Process (`src/renderer/src/`)

- **`js/core/app.js`**: Central orchestrator (~82KB) — main application logic
- **`js/api/`**: API wrappers mirroring IPC handlers in main process
- **`js/extensions/`**: Plugin system (TypeScript) — core infrastructure, API, built-in plugins
- **`js/pages/`**, **`js/components/`**, **`js/services/`**, **`js/utils/`**: Standard UI organization
- **`styles/`**: SCSS stylesheets
- Two HTML entry points: `index.html` (main app) and `DesktopLyrics.html` (separate window)

### Native Audio Module (`native/`)

- Rust-based audio engine: decoding (rodio/symphonia), WASAPI exclusive output, resampling (rubato), EQ (biquad)
- Built as `NativeAudio.node` N-API addon, loaded by main process
- Release profile: LTO enabled, opt-level=3, stripped

### Vite Configuration (`src/renderer/vite.config.js`)

- Root: `src/`, output: `public/`
- Target: Chrome 138
- Manual chunks: vendor, extensions, components, shared-utils
- Path aliases: `@`, `@js`, `@core`, `@services`, `@utils`, `@api`, `@pages`, `@components`, `@extensions`, `@styles`, `@assets`

## Key Patterns

### IPC Communication Flow (New Architecture)

To add main process functionality accessible from renderer:

1. **Create a Controller** in `src/main/controllers/` (or update existing one)
   ```typescript
   import { BaseController, IpcHandler } from '../decorators/IpcHandler';
   
   export class MyController extends BaseController {
       @IpcHandler('my-domain:action')
       async handleAction(event: any, arg: any) {
           // Implementation
           return result;
       }
   }
   ```

2. **Register Controller** in `Application.registerControllers()` (`core/Application.ts`)
   ```typescript
   const myController = new MyController();
   await myController.register(this.container);
   this.controllers.push(myController);
   ```

3. **Use from Renderer** via `window.electronAPI.*` (exposed through preload.ts)
   ```javascript
   const result = await window.electronAPI.invoke('my-domain:action', arg);
   ```

Channel naming convention: `domain:action` (e.g., `audio:loadTrack`, `library:scan`)

### Plugin System

Located in `src/renderer/src/js/extensions/`:
- **Docs**: `docs/PluginSystemGuide.md`, `docs/Architecture.md`
- **Core** (`core/`): TypeScript — lifecycle, events, DI, registry, activation, permissions, host management
- **API** (`api/`): Exposes namespaced API (player, library, ui, storage, settings, navigation, etc.)
- **Built-in plugins**: `builtin/` — serve as reference implementations
- Each plugin needs: `manifest.json` + entry file exporting `activate(context)` / `deactivate()`
- Activation events: `onStartUp`, `onCommand:*`, `onView:*`, `*`

### Library Cache System

- **LibraryCacheManager** (`src/main/services/library/LibraryCacheManager.ts`): Central music library cache
  - Stores parsed metadata for all music files
  - Handles incremental updates and file watching
  - Provides query interface for renderer process
- **AutoScanScheduler** (`src/main/services/library/AutoScanScheduler.ts`): Automatic library scanning
- **MetadataHandler** (`src/main/services/library/MetadataHandler.ts`): Metadata parsing and editing
- Controllers: `LibraryController`, `CoversController`, `LyricsController`

### Network Drive Support

- **NetworkDriveManager** (`src/main/services/network/NetworkDriveManager.ts`): Manages SMB and WebDAV connections
- **NetworkFileAdapter** (`src/main/services/network/NetworkFileAdapter.ts`): Unified interface for local and network files
- **DriveRegistry** (`src/main/services/network/DriveRegistry.ts`): Registry for mounted network drives
- Supports mounting network shares as virtual drives
- Metadata parsing works transparently with network files

### Build & Packaging

- **Electron Builder**: `electron-builder.yml` — targets Windows (NSIS + portable), macOS (DMG + ZIP), Linux (AppImage + deb + rpm)
- `NativeAudio.node` and `metadata_editor.exe` are unpacked from ASAR and placed in extraResources
- **Python module**: Built via `scripts/build-python-module.js` using PyInstaller (fallback to Nuitka if PyInstaller fails)
- **Rust module**: Built via napi-rs with `cargo-cp-artifact`, outputs to `dist/main/NativeAudio.node`
- **TypeScript**: Compiled to `dist/main/` via `tsc -p src/main/tsconfig.json`

## Important Development Notes

### Main Process TypeScript Migration
- Main process has been fully migrated from JavaScript to TypeScript
- All `.js` files in `src/main/` are now `.ts`
- Uses controller-based architecture with `@IpcHandler` decorators
- Service container pattern for dependency injection

### Python Metadata Editor
- Source: `src/main/metadata_editor.py`
- Dependencies: mutagen (defined in `requirements.txt`)
- Build process automatically tries PyInstaller first, falls back to Nuitka
- Compiled executable is copied to `src/main/` for packaging

### Native Audio Module
- Built with Rust 1.89.0 (specific version required)
- Uses WASAPI for Windows exclusive audio mode
- Release build uses LTO and opt-level=3 for performance
- Must rebuild after Rust code changes: `npm run build:rs`

### Development Workflow
- Main process changes: Run `npm run build:ts` (or `npm run watch:ts`), then restart `npm run dev`
- Renderer UI changes: Use `npm run dev:renderer` for faster iteration (Vite HMR)
- Rust changes: Run `npm run build:rs` then restart main process
- Python changes: Run `npm run build:python` then restart main process

## Code Style Notes

- **TypeScript**: Main process uses TypeScript with strict mode
- **JavaScript**: ES6+ with `async/await` for async operations in renderer
- **TypeScript**: Extension system only (`src/renderer/src/js/extensions/`)
- **Resource cleanup**: Disposable pattern in extension system
- **Log outputs**: Must start with relevant emoji icons for quick identification (project convention)
  - 🔧 Configuration/setup
  - ✅ Success operations
  - ❌ Errors
  - 🔄 Loading/processing
  - 🎵 Audio-related
  - 📦 Build/packaging
  - ⚠️ Warnings
- **IPC naming**: Use `domain:action` pattern (e.g., `audio:init`, `library:scan`)
- **File organization**: Controllers in `src/main/controllers/`, services in `src/main/services/`
- **Decorators**: Use `@IpcHandler('channel:name')` for IPC handler methods in controllers

## Testing

No test framework configured. No test commands in package.json.
