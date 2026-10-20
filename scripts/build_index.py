# -*- coding: utf-8 -*-
"""扫描 files/ 目录，生成网页用的索引 data/documents.json。

用法：
    python scripts/build_index.py

规则：
    - files/ 下的一级目录 = 一个分类，目录名去掉 "01-" 这类数字前缀后作为显示名；
    - files/ 根目录下的 PDF 归入「未分类」；
    - 只收录 .pdf 文件，其它文件忽略；
    - 更新时间优先取 git 最后一次提交时间，其次沿用旧索引，最后回退文件修改时间。
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES_DIR = ROOT / "files"
OUT_FILE = ROOT / "data" / "documents.json"
SITE_FILE = ROOT / "site.json"

TZ = timezone(timedelta(hours=8))
UNCATEOGRIZED = "未分类"
SKIP_DIRS = {"node_modules", ".git", ".github", "assets", "scripts", "data"}


def load_site() -> dict:
    site = {
        "title": "AIP 售后文件库",
        "description": "售后资料集中存放，按分类归档，支持搜索与在线预览",
        "repo": "",
    }
    if SITE_FILE.exists():
        try:
            site.update(json.loads(SITE_FILE.read_text(encoding="utf-8")))
        except Exception as exc:  # 配置写错时不影响索引生成
            print(f"[warn] site.json 解析失败：{exc}")
    return site


def load_old_docs() -> dict:
    """读取旧索引，用于沿用历史更新时间。"""
    if not OUT_FILE.exists():
        return {}
    try:
        data = json.loads(OUT_FILE.read_text(encoding="utf-8"))
        return {d["file"]: d for d in data.get("documents", []) if "file" in d}
    except Exception:
        return {}


def git_last_commit(rel_path: str) -> str | None:
    try:
        proc = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", rel_path],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode == 0:
            value = proc.stdout.strip()
            if value:
                return value
    except Exception:
        pass
    return None


def to_iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, TZ).isoformat(timespec="seconds")


def display_name(dir_name: str) -> str:
    name = re.sub(r"^\d+[\s._-]*", "", dir_name).strip()
    return name or dir_name


def collect():
    if not FILES_DIR.exists():
        FILES_DIR.mkdir(parents=True, exist_ok=True)

    old_docs = load_old_docs()
    docs = []

    def add_doc(pdf: Path, category_id: str, category_name: str):
        rel = pdf.relative_to(ROOT).as_posix()
        size = pdf.stat().st_size
        updated = None
        previous = old_docs.get(rel)
        if previous and previous.get("bytes") == size and previous.get("updated"):
            updated = previous["updated"]
        updated = git_last_commit(rel) or updated or to_iso(pdf.stat().st_mtime)
        docs.append(
            {
                "id": rel,
                "file": rel,
                "title": pdf.stem,
                "categoryId": category_id,
                "category": category_name,
                "bytes": size,
                "updated": updated,
            }
        )

    # 一级分类目录
    for entry in sorted(FILES_DIR.iterdir(), key=lambda p: p.name):
        if not entry.is_dir() or entry.name.startswith(".") or entry.name in SKIP_DIRS:
            continue
        for pdf in sorted(entry.rglob("*")):
            if pdf.is_file() and pdf.suffix.lower() == ".pdf":
                add_doc(pdf, entry.name, display_name(entry.name))

    # 根目录散落的 PDF
    for pdf in sorted(FILES_DIR.glob("*")):
        if pdf.is_file() and pdf.suffix.lower() == ".pdf":
            add_doc(pdf, "", UNCATEOGRIZED)

    docs.sort(key=lambda d: (d["updated"], d["title"]), reverse=True)

    # 分类汇总（保持目录数字顺序）
    order = {}
    for entry in sorted(FILES_DIR.iterdir(), key=lambda p: p.name):
        if entry.is_dir() and not entry.name.startswith(".") and entry.name not in SKIP_DIRS:
            order[entry.name] = display_name(entry.name)

    categories = []
    for cid, name in order.items():
        items = [d for d in docs if d["categoryId"] == cid]
        categories.append(
            {
                "id": cid,
                "name": name,
                "count": len(items),
                "bytes": sum(d["bytes"] for d in items),
            }
        )
    loose = [d for d in docs if not d["categoryId"]]
    if loose:
        categories.append(
            {
                "id": "",
                "name": UNCATEOGRIZED,
                "count": len(loose),
                "bytes": sum(d["bytes"] for d in loose),
            }
        )

    return docs, categories


def main() -> int:
    site = load_site()
    docs, categories = collect()
    payload = {
        "site": {
            **site,
            "generatedAt": datetime.now(TZ).isoformat(timespec="seconds"),
        },
        "stats": {
            "documents": len(docs),
            "categories": len([c for c in categories if c["count"]]),
            "bytes": sum(d["bytes"] for d in docs),
        },
        "categories": categories,
        "documents": docs,
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    OUT_FILE.write_text(text + "\n", encoding="utf-8")

    # 同步输出一份 JS 版本，便于直接双击 index.html 打开（file:// 下无法 fetch）
    js_file = ROOT / "data" / "documents.js"
    js_file.write_text(
        "/* 由 scripts/build_index.py 自动生成，请勿手动修改 */\n"
        "window.__DOCUMENTS__ = " + text + ";\n",
        encoding="utf-8",
    )

    print(f"[ok] {OUT_FILE.relative_to(ROOT)}")
    print(f"[ok] {js_file.relative_to(ROOT)}")
    print(f"     文档 {payload['stats']['documents']} 个 / 分类 {payload['stats']['categories']} 个")
    return 0


if __name__ == "__main__":
    sys.exit(main())
