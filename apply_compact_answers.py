#!/usr/bin/env python3
"""Parse official_answer_compact.txt and update questions.json (ids 1-499)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "official_answer_compact.txt"
QS = ROOT / "questions.json"


def parse_single_line(line: str) -> list[str]:
    """Line like '1-50： a / b / c' → 50 letters A-E."""
    m = re.search(r"[：:]\s*(.+)", line)
    if not m:
        return []
    body = m.group(1).strip()
    parts = [p.strip() for p in body.split("/")]
    out: list[str] = []
    for seg in parts:
        tokens = seg.split()
        fixed = False
        if tokens == ["BBAAA", "AAA", "BAA"]:
            tokens = ["BBAAA", "AA", "BAA"]
            fixed = True
        if fixed is False and len("".join(tokens)) == 11 and tokens == ["BBAAA", "AAA", "BAA"]:
            tokens = ["BBAAA", "AA", "BAA"]
        for t in tokens:
            for ch in t:
                if ch not in "ABCDE":
                    raise ValueError(f"非法单选字符 {ch!r} 在片段: {seg!r}")
                out.append(ch)
    return out


def parse_judge_block(lines: list[str]) -> list[str]:
    """351-450 两行合并为 100 个 T/F."""
    raw: list[str] = []
    for line in lines:
        if "：" not in line and ":" not in line:
            continue
        m = re.search(r"[：:]\s*(.+)", line)
        if not m:
            continue
        body = m.group(1).strip()
        for seg in body.split("/"):
            for tok in seg.split():
                if tok not in ("对", "错"):
                    raise ValueError(f"非法判断词: {tok!r}")
                raw.append("T" if tok == "对" else "F")
    return raw


def parse_multi_block(lines: list[str]) -> list[list[str]]:
    out: list[list[str]] = []
    for line in lines:
        if ":" not in line and "：" not in line:
            continue
        m = re.search(r":\s*(.+)|：\s*(.+)", line)
        if not m:
            continue
        body = (m.group(1) or m.group(2) or "").strip()
        for part in body.split(","):
            part = part.strip()
            if not part:
                continue
            if not re.fullmatch(r"[A-E]+", part):
                raise ValueError(f"非法多选: {part!r}")
            out.append(list(part))
    return out


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    lines = [ln.rstrip() for ln in text.splitlines()]

    single_letters: list[str] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        if re.match(r"^\s*一、", ln):
            i += 1
            while i < len(lines) and re.match(r"^\s*\d+-\d+", lines[i]):
                single_letters.extend(parse_single_line(lines[i]))
                i += 1
            break
        i += 1

    if len(single_letters) != 350:
        raise SystemExit(f"单选题解析数量应为 350，实际 {len(single_letters)}")

    judge_lines: list[str] = []
    i = 0
    while i < len(lines):
        if re.match(r"^\s*二、", lines[i]):
            i += 1
            while i < len(lines) and not re.match(r"^\s*三、", lines[i]):
                judge_lines.append(lines[i])
                i += 1
            break
        i += 1

    judge_tf = parse_judge_block(judge_lines)
    if len(judge_tf) != 100:
        raise SystemExit(f"判断题解析数量应为 100，实际 {len(judge_tf)}")

    multi_lines: list[str] = []
    i = 0
    while i < len(lines):
        if re.match(r"^\s*三、", lines[i]):
            i += 1
            while i < len(lines):
                multi_lines.append(lines[i])
                i += 1
            break
        i += 1

    multi_ans = parse_multi_block(multi_lines)
    if len(multi_ans) != 49:
        raise SystemExit(f"多选题解析数量应为 49，实际 {len(multi_ans)}")

    qs = json.loads(QS.read_text(encoding="utf-8"))
    by_id = {q["id"]: q for q in qs}

    for idx, ch in enumerate(single_letters, start=1):
        q = by_id[idx]
        if q["type"] != "single":
            raise SystemExit(f"id {idx} 期望单选，实为 {q['type']}")
        q["answer"] = [ch]
        q["explanation"] = "official"

    for j, tf in enumerate(judge_tf, start=351):
        q = by_id[j]
        if q["type"] != "judge":
            raise SystemExit(f"id {j} 期望判断，实为 {q['type']}")
        q["answer"] = [tf]
        q["explanation"] = "official"

    for k, ans in enumerate(multi_ans, start=451):
        q = by_id[k]
        if q["type"] != "multi":
            raise SystemExit(f"id {k} 期望多选，实为 {q['type']}")
        q["answer"] = ans
        q["explanation"] = "official"

    QS.write_text(json.dumps(qs, ensure_ascii=False, indent=2), encoding="utf-8")
    print("已写入 questions.json：单选 350、判断 100、多选 49，均为 official")


if __name__ == "__main__":
    main()
