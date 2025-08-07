# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

project_root = os.path.dirname(os.path.abspath(SPEC))
src_main = os.path.join(project_root, 'src', 'main')

a = Analysis(
    [os.path.join(src_main, 'metadata_editor.py')],
    pathex=[src_main, project_root],
    binaries=[],
    datas=collect_data_files('mutagen'),

    hiddenimports=[
        'mutagen',
        'mutagen.id3',
        'mutagen.flac',
        'mutagen.mp4',
        'mutagen.oggvorbis',
        'mutagen.oggflac',
        'mutagen.apev2',
        'mutagen._util',
        'mutagen._file',
        'mutagen._tags',
        'mutagen._vorbis',
    ] + collect_submodules('mutagen'),
    
    # 钩子目录
    hookspath=[],
    
    # 运行时钩子
    hooksconfig={},
    
    # 排除的模块 - 减少打包大小
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'scipy',
        'pandas',
        'PIL',
        'cv2',
        'torch',
        'tensorflow',
        'jupyter',
        'IPython',
        'pytest',
        'unittest',
        'doctest',
    ],
    
    # 不分析的模块
    noarchive=False,
    
    # 优化级别
    optimize=2,
)

# 创建PYZ文件
pyz = PYZ(a.pure, a.zipped_data, cipher=None)

# 创建可执行文件
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],

    name='metadata_editor',
    
    # 调试选项
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # 启用UPX压缩
    upx_exclude=[],
    
    # 运行时选项
    runtime_tmpdir=None,
    console=True,  # 保持控制台模式，便于调试和JSON输出
    disable_windowed_traceback=False,

    icon=None,
    version=None,
    manifest=None,
    resources=[],
    onefile=True,
)


if sys.platform == 'darwin':  # macOS
    app = BUNDLE(
        exe,
        name='metadata_editor.app',
        icon=None,
        bundle_identifier='com.musicbox.metadata-editor',
        info_plist={
            'CFBundleDisplayName': 'MusicBox Metadata Editor',
            'CFBundleVersion': '1.0.0',
            'CFBundleShortVersionString': '1.0.0',
            'NSHighResolutionCapable': True,
        },
    )
