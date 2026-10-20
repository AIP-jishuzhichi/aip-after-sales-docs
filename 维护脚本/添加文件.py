# -*- coding: utf-8 -*-
"""把 PDF 归档进「售后资料」文件夹并自动更新文件清单（可选自动提交推送）。

用法：
    python 维护脚本/添加文件.py "D:/资料/某手册.pdf" --category 产品手册
    python 维护脚本/添加文件.py a.pdf b.pdf --category 维修与调试 --push
    python 维护脚本/添加文件.py a.pdf          # 不给分类则放进 售后资料/ 根目录

参数：
    --category  分类名或文件夹名（如 产品手册 / 01-产品手册）；不存在会自动新建
    --title     覆盖网页上显示的标题（默认用文件名）
    --push      归档后自动 git add / commit / push
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES_DIR = ROOT / "售后资料"
SKIP_DIRS = {"node_modules", ".git", ".github", "网页资源", "维护脚本", "索引数据"}


def existing_categories() -> dict[str, Path]:
    """返回 {显示名: 目录, 目录名: 目录} 两种键，方便按中文名查找。"""
    result: dict[str, Path] = {}
    if not FILES_DIR.exists():
        return result
    for entry in sorted(FILES_DIR.iterdir()):
        if not entry.is_dir() or entry.name.startswith(".") or entry.name in SKIP_DIRS:
            continue
        name = re.sub(r"^\d+[\s._-]*", "", entry.name).strip() or entry.name
        result[name] = entry
        result[entry.name] = entry
    return result


def resolve_category(category: str | None) -> Path:
    if not category:
        return FILES_DIR
    cats = existing_categories()
    if category in cats:
        return cats[category]
    # 新建目录，编号接在现有最大编号之后
    max_no = 0
    if FILES_DIR.exists():
        for entry in FILES_DIR.iterdir():
            m = re.match(r"^(\d+)", entry.name)
            if entry.is_dir() and m:
                max_no = max(max_no, int(m.group(1)))
    target = FILES_DIR / f"{max_no + 1:02d}-{category.strip()}"
    target.mkdir(parents=True, exist_ok=True)
    print(f"[new] 新建分类目录 {target.relative_to(ROOT)}")
    return target


def unique_path(target_dir: Path, filename: str) -> Path:
    path = target_dir / filename
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    i = 2
    while True:
        candidate = target_dir / f"{stem}-{i}{suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def run(cmd: list[str], check: bool = False) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
    if check and proc.returncode != 0:
        print(proc.stdout.strip())
        print(proc.stderr.strip())
    return proc


def git_ready() -> bool:
    return run(["git", "rev-parse", "--is-inside-work-tree"]).returncode == 0


def has_remote() -> bool:
    proc = run(["git", "remote"])
    return proc.returncode == 0 and bool(proc.stdout.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description="归档 PDF 到文件库并更新索引")
    parser.add_argument("files", nargs="+", help="一个或多个 PDF 文件路径")
    parser.add_argument("--category", default=None, help="分类名，例如 产品手册")
    parser.add_argument("--title", default=None, help="自定义标题（仅单文件时生效）")
    parser.add_argument("--push", action="store_true", help="归档后自动提交并推送")
    args = parser.parse_args()

    target_dir = resolve_category(args.category)
    added = []

    for raw in args.files:
        src = Path(raw).expanduser()
        if not src.exists() or not src.is_file():
            print(f"[skip] 找不到文件：{raw}")
            continue
        if src.suffix.lower() != ".pdf":
            print(f"[skip] 不是 PDF：{src.name}")
            continue
        if src.name.lower().endswith(".pdf") and src.parent.resolve() == target_dir.resolve():
            print(f"[keep] 已在目标目录：{src.name}")
            added.append(src)
            continue
        dest = unique_path(target_dir, src.name)
        try:
            shutil.copy2(src, dest)
        except PermissionError:
            print(f"[fail] 没有权限写入 {dest}")
            continue
        print(f"[add] {dest.relative_to(ROOT)}  ({dest.stat().st_size / 1024:.0f} KB)")
        added.append(dest)

    if not added:
        print("没有文件被归档。")
        return 1

    print("\n[1/2] 重新生成文件清单 …")
    proc = run([sys.executable, str(ROOT / "维护脚本" / "生成清单.py")])
    sys.stdout.write(proc.stdout)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        return 1

    if not args.push:
        print("\n完成。执行 git add -A && git commit && git push 即可同步到 GitHub。")
        return 0

    if not git_ready():
        print("\n[!] 当前目录不是 git 仓库，已跳过提交。")
        return 0

    print("\n[2/2] 提交并推送 …")
    run(["git", "add", "-A"])
    msg = "docs: 归档 " + "、".join(p.name for p in added[:3]) + (" 等" if len(added) > 3 else "")
    run(["git", "commit", "-m", msg])
    if not has_remote():
        print("[!] 还没有配置远程仓库，跳过推送。")
        return 0
    push = run(["git", "push"])
    if push.returncode != 0:
        print("[!] 推送失败，稍后可以手动执行 git push：")
        print("   ", (push.stderr or push.stdout).strip().splitlines()[-1] if (push.stderr or push.stdout).strip() else "")
        return 0
    print("[ok] 已推送到 GitHub，网页会在 1 分钟内更新。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
