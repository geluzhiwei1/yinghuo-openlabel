import os
import zipfile
import tempfile
from pathlib import Path
from typing import Set

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()


def should_exclude(path: Path, exclude_patterns: Set[str]) -> bool:
    """检查路径是否应该被排除"""
    path_str = str(path)
    
    # 检查排除模式
    for pattern in exclude_patterns:
        if pattern in path_str:
            return True
    
    # 检查特定目录和文件
    if path.name.startswith('.'):
        return True
    
    # 检查文件扩展名
    if path.suffix in {'.pyc', '.pyo', '.pyd', '.so', '.dylib', '.dll'}:
        return True
    
    return False


def create_source_zip() -> str:
    """创建包含源代码的zip文件"""
    # 项目根目录
    project_root = Path(__file__).parent.parent.parent.parent.parent
    
    # 排除模式
    exclude_patterns = {
        '.git',
        'venv',
        '__pycache__',
        'node_modules',
        '.pytest_cache',
        'dist',
        'build',
        '*.egg-info',
        '.coverage',
        '.tox',
        '.mypy_cache',
        '.DS_Store',
        'Thumbs.db',
        'docker/postgres-data',
        'docker/redis-data',
    }
    
    # 创建临时文件
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    temp_file.close()
    
    try:
        with zipfile.ZipFile(temp_file.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 遍历项目目录
            for root, dirs, files in os.walk(project_root):
                root_path = Path(root)
                
                # 过滤目录
                dirs[:] = [d for d in dirs if not should_exclude(root_path / d, exclude_patterns)]
                
                # 过滤并添加文件
                for file in files:
                    file_path = root_path / file
                    
                    if not should_exclude(file_path, exclude_patterns):
                        # 计算相对路径
                        relative_path = file_path.relative_to(project_root)
                        zipf.write(file_path, relative_path)
        
        return temp_file.name
    
    except Exception:
        # 清理临时文件
        os.unlink(temp_file.name)
        raise


@router.get("/api/source-code")
async def download_source_code():
    """下载项目源代码端点"""
    zip_path = create_source_zip()
    
    def iterfile():
        try:
            with open(zip_path, mode="rb") as file_like:
                yield from file_like
        finally:
            # 清理临时文件
            os.unlink(zip_path)
    
    return StreamingResponse(
        iterfile(),
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=yinghuo-openlabel-source.zip"
        }
    )