# -*- coding: utf-8 -*-
"""把「售后资料」文件夹的改动上传到 GitHub（自动重试 + 明确提示）。

用法：
    双击 ④删除后上传.cmd
    或命令行：python 维护脚本/上传.py

特点：
    - 上传失败会重试 3 次，仍失败则明确告知"网络问题，稍后再双击一次"
    - 已提交但没上传成功的改动会保留，下次双击会继续上传，不会白做
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def say(text: str = "") -> None:
    print(text, flush=True)


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        args, cwd=str(ROOT), capture_output=True, text=True,
        encoding="utf-8", errors="replace",
    )


def last_line(text: str) -> str:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    return lines[-1] if lines else ""


def main() -> int:
    # 1. 重新生成文件清单
    say("[1/3] 重新生成文件清单 …")
    gen = run([sys.executable, "-X", "utf8", str(ROOT / "维护脚本" / "生成清单.py")])
    if gen.returncode != 0:
        say("  清单生成失败，请把下面的信息发给技术支持：")
        say((gen.stderr or gen.stdout)[-800:])
        return 1

    # 2. 记录改动
    say("[2/3] 记录本次改动 …")
    run(["git", "add", "-A"])
    staged = run(["git", "diff", "--cached", "--quiet"]).returncode != 0
    if staged:
        commit = run(["git", "commit", "-m", "docs: 更新售后资料"])
        if commit.returncode != 0:
            say("  提交失败，请把下面的信息发给技术支持：")
            say((commit.stdout + commit.stderr)[-800:])
            return 1

    # 3. 上传（含之前没传成功的改动）
    say("[3/3] 上传到 GitHub …")
    pending = run(["git", "rev-list", "--count", "origin/main..HEAD"]).stdout.strip()
    if pending in ("", "0"):
        say("")
        say("没有任何变化，无需上传。")
        return 0

    for attempt in range(1, 4):
        push = run(["git", "push", "origin", "HEAD:main"])
        if push.returncode == 0:
            say("")
            say("上传成功！网页大约 1 分钟后同步。")
            return 0
        reason = last_line(push.stderr) or last_line(push.stdout) or "未知错误"
        say(f"  第 {attempt} 次上传失败：{reason}")
        if attempt < 3:
            say("  5 秒后自动重试 …")
            time.sleep(5)

    say("")
    say("上传失败了 —— 一般是电脑当前连不上 GitHub（网络波动）。")
    say("你的文件已经保存在本地，改动也已经记录好，不会白做。")
    say("等几分钟网络正常后，再双击一次「④删除后上传」即可。")
    return 1


if __name__ == "__main__":
    sys.exit(main())
