"""版本判定 + 目录存在性校验。

YH_EDITION 三档单调全序:ce < ee < saas。
- ce:   社区版(开源 AGPL),仅主代码
- ee:   企业版,主代码 + ee/ 包(由独立仓库 yinghuo-openlabel-ee 提供)
- saas: SaaS 版,主代码 + ee/ + saas/ 包(再加 yinghuo-openlabel-saas)

仓库拓扑(2026-07-30 重构后):
- yinghuo-openlabel(CE 公开仓库):本文件所在仓库,不含 ee/ 与 saas/ 目录
- yinghuo-openlabel-ee(私有仓库):挂载到 services/web-api/src/yinghuo_app/ee/
                                    + apps/web-app/{,src/}ee/
- yinghuo-openlabel-saas(私有仓库):挂载到 services/web-api/src/yinghuo_app/saas/
                                     + apps/web-app/{,src/}saas/

挂载方式:yinghuo-openlabel-ee / yinghuo-openlabel-saas 私有仓库各自的
`scripts/setup-edition.sh`(CE_ROOT 指向本仓)用 git clone 把私有仓拉到上述路径。
本仓库的 .gitignore 已排除这些路径,防止误提交。

所有"是否加载某版"的判断都走这里。YH_EDITION 是显式声明,目录存在性是客观事实——
两者不一致时启动期 fail-fast,避免"YH_EDITION=ee 但 ee/ 未挂载"的隐蔽 bug。
"""
import os
from pathlib import Path

# 本文件所在:services/web-api/src/yinghuo_app/edition.py
# 仓库根:向上 4 层
_REPO_ROOT = Path(__file__).resolve().parents[4]
_BACKEND_ROOT = Path(__file__).resolve().parent  # .../yinghuo_app

EE_BACKEND_DIR = _BACKEND_ROOT / "ee"
SAAS_BACKEND_DIR = _BACKEND_ROOT / "saas"
EE_FRONTEND_DIR = _REPO_ROOT / "apps" / "web-app" / "ee"
EE_FRONTEND_SRC_DIR = _REPO_ROOT / "apps" / "web-app" / "src" / "ee"
SAAS_FRONTEND_DIR = _REPO_ROOT / "apps" / "web-app" / "saas"
SAAS_FRONTEND_SRC_DIR = _REPO_ROOT / "apps" / "web-app" / "src" / "saas"


def _ee_dirs_present() -> bool:
    """EE 挂载完整性:后端必在,前端目录至少有一个(HTML 入口或 Vue 源码)。"""
    if not EE_BACKEND_DIR.is_dir():
        return False
    return EE_FRONTEND_DIR.is_dir() or EE_FRONTEND_SRC_DIR.is_dir()


def _saas_dirs_present() -> bool:
    """SaaS 挂载完整性:后端必在(前端 SaaS 阶段 3 暂未拆,可缺)。"""
    return SAAS_BACKEND_DIR.is_dir()


_raw = os.getenv("YH_EDITION", "ce").lower()
LEVEL = {"ce": 1, "ee": 2, "saas": 3}.get(_raw, 1)
NAME = _raw if LEVEL > 1 else "ce"

# 客观可用性:目录存在才算真有
HAS_EE = LEVEL >= 2 and _ee_dirs_present()
HAS_SAAS = LEVEL >= 3 and _saas_dirs_present()

# 一致性校验:声明了某版但目录缺失 → 启动期硬失败,避免隐蔽 bug
if LEVEL >= 2 and not _ee_dirs_present():
    raise RuntimeError(
        f"YH_EDITION={_raw} 但 EE 目录未挂载。"
        f"到 yinghuo-openlabel-ee 私有仓运行 `CE_ROOT=<本仓路径> scripts/setup-edition.sh ee`,"
        f"或改用 YH_EDITION=ce。(缺失路径:{EE_BACKEND_DIR})"
    )
if LEVEL >= 3 and not _saas_dirs_present():
    raise RuntimeError(
        f"YH_EDITION={_raw} 但 SaaS 目录未挂载。"
        f"到 yinghuo-openlabel-saas 私有仓运行"
        f"`CE_ROOT=<本仓路径> YH_EDITION_EE_REPO=<ee 仓> scripts/setup-edition.sh saas`,"
        f"或改用 YH_EDITION<=ee。(缺失路径:{SAAS_BACKEND_DIR})"
    )
