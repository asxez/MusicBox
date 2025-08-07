"""
音频元数据编辑器
"""

import argparse
import base64
import json
import os
import sys
import traceback

try:
    from mutagen import File
    from mutagen.id3 import ID3NoHeaderError
    from mutagen.flac import FLAC
    from mutagen.mp4 import MP4, MP4Cover
    from mutagen.oggvorbis import OggVorbis
    from mutagen.oggflac import OggFLAC
    from mutagen.apev2 import APEv2File
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"缺少必要的Python库: {str(e)}。请安装mutagen: pip install mutagen",
        "error_type": "import_error"
    }), file=sys.stderr)
    sys.exit(1)


def log_debug(message):
    print(f"DEBUG: {message}", file=sys.stderr)


def detect_audio_format(file_path):
    try:
        audio_file = File(file_path)
        if audio_file is None:
            return None

        file_type = type(audio_file).__name__
        log_debug(f"检测到音频格式: {file_type}")
        return file_type
    except Exception as e:
        log_debug(f"格式检测失败: {str(e)}")
        return None


def load_cover_data(metadata):
    cover_data = None

    # 从文件加载封面数据
    if metadata.get('cover_file'):
        try:
            cover_file_path = metadata['cover_file']
            log_debug(f"从文件加载封面数据: {cover_file_path}")

            if os.path.exists(cover_file_path):
                with open(cover_file_path, 'rb') as f:
                    cover_data = f.read()
                log_debug(f"成功加载封面文件，大小: {len(cover_data)} 字节")
            else:
                log_debug(f"封面文件不存在: {cover_file_path}")
        except Exception as e:
            log_debug(f"加载封面文件失败: {str(e)}")

    # base64数据
    elif metadata.get('cover_data'):
        try:
            cover_data = base64.b64decode(metadata['cover_data'])
            log_debug(f"从base64加载封面数据，大小: {len(cover_data)} 字节")
        except Exception as e:
            log_debug(f"解码base64封面数据失败: {str(e)}")

    return cover_data


def update_flac_metadata(file_path, metadata):
    try:
        audio = FLAC(file_path)

        # 更新基本元数据
        if metadata.get('title'):
            audio['TITLE'] = metadata['title']
        if metadata.get('artist'):
            audio['ARTIST'] = metadata['artist']
        if metadata.get('album'):
            audio['ALBUM'] = metadata['album']
        if metadata.get('year'):
            audio['DATE'] = str(metadata['year'])
        if metadata.get('genre'):
            audio['GENRE'] = metadata['genre']

        # 处理封面
        cover_data = load_cover_data(metadata)
        if cover_data:
            try:
                # 清除现有封面
                audio.clear_pictures()
                # 添加新封面
                from mutagen.flac import Picture
                picture = Picture()
                picture.type = 3  # Cover (front)
                picture.mime = 'image/jpeg'
                picture.desc = 'Album Cover'
                picture.data = cover_data
                audio.add_picture(picture)
                log_debug("FLAC封面更新成功")
            except Exception as e:
                log_debug(f"FLAC封面更新失败: {str(e)}")

        audio.save()
        return True
    except Exception as e:
        log_debug(f"FLAC元数据更新失败: {str(e)}")
        return False


def update_mp4_metadata(file_path, metadata):
    """更新M4A/MP4元数据"""
    try:
        audio = MP4(file_path)

        # 更新基本元数据
        if metadata.get('title'):
            audio['\xa9nam'] = metadata['title']
        if metadata.get('artist'):
            audio['\xa9ART'] = metadata['artist']
        if metadata.get('album'):
            audio['\xa9alb'] = metadata['album']
        if metadata.get('year'):
            audio['\xa9day'] = str(metadata['year'])
        if metadata.get('genre'):
            audio['\xa9gen'] = metadata['genre']

        # 处理封面
        cover_data = load_cover_data(metadata)
        if cover_data:
            try:
                audio['covr'] = [MP4Cover(cover_data, MP4Cover.FORMAT_JPEG)]
                log_debug("MP4封面更新成功")
            except Exception as e:
                log_debug(f"MP4封面更新失败: {str(e)}")

        audio.save()
        return True
    except Exception as e:
        log_debug(f"MP4元数据更新失败: {str(e)}")
        return False


def update_ogg_metadata(file_path, metadata):
    try:
        audio = OggVorbis(file_path)

        # 更新基本元数据
        if metadata.get('title'):
            audio['TITLE'] = metadata['title']
        if metadata.get('artist'):
            audio['ARTIST'] = metadata['artist']
        if metadata.get('album'):
            audio['ALBUM'] = metadata['album']
        if metadata.get('year'):
            audio['DATE'] = str(metadata['year'])
        if metadata.get('genre'):
            audio['GENRE'] = metadata['genre']

        # OGG Vorbis 不直接支持内嵌封面，但可以通过 METADATA_BLOCK_PICTURE 实现
        # 跳过封面处理，实现较复杂
        audio.save()
        return True
    except Exception as e:
        log_debug(f"OGG元数据更新失败: {str(e)}")
        return False


def update_metadata(file_path, metadata):
    if not os.path.exists(file_path):
        return False, "文件不存在"

    format_type = detect_audio_format(file_path)
    if not format_type:
        return False, "无法识别的音频格式"
    log_debug(f"处理文件: {file_path}, 格式: {format_type}")

    if format_type == 'FLAC':
        success = update_flac_metadata(file_path, metadata)
    elif format_type in ['MP4', 'M4A']:
        success = update_mp4_metadata(file_path, metadata)
    elif format_type in ['OggVorbis', 'OggFLAC']:
        success = update_ogg_metadata(file_path, metadata)
    else:
        return False, f"不支持的音频格式: {format_type}"

    if success:
        return True, "元数据更新成功"
    else:
        return False, "元数据更新失败"


def load_metadata_from_file(metadata_file_path):
    try:
        with open(metadata_file_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        log_debug(f"从文件加载元数据: {metadata_file_path}")
        return metadata
    except Exception as e:
        log_debug(f"加载元数据文件失败: {str(e)}")
        raise


def main():
    parser = argparse.ArgumentParser(description='音频元数据编辑器')
    parser.add_argument('file_path', help='音频文件路径')
    parser.add_argument('metadata_source', nargs='?', help='元数据JSON字符串或--metadata-file参数')
    parser.add_argument('--metadata-file', help='元数据JSON文件路径')

    try:
        args = parser.parse_args()

        # 确定元数据来源
        if args.metadata_file:
            # 从文件加载元数据
            metadata = load_metadata_from_file(args.metadata_file)
            log_debug(f"使用元数据文件: {args.metadata_file}")
        elif args.metadata_source:
            # 从命令行参数解析元数据JSON
            metadata = json.loads(args.metadata_source)
            log_debug("使用命令行元数据参数")
        else:
            raise ValueError("必须提供元数据JSON字符串或--metadata-file参数")

        log_debug(f"处理文件: {args.file_path}")
        log_debug(f"元数据内容: {metadata}")

        success, message = update_metadata(args.file_path, metadata)
        result = {
            "success": success,
            "message": message,
            "file_path": args.file_path
        }
        print(json.dumps(result, ensure_ascii=False))

    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False,
            "error": f"JSON解析错误: {str(e)}",
            "error_type": "json_error"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"处理错误: {str(e)}",
            "error_type": "processing_error",
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
