#!/usr/bin/env python3
"""Parse official_answer_source.md and merge into questions.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "official_answer_source.md"
QS = ROOT / "questions.json"


def parse_source(text: str) -> dict[int, list[str]]:
    out: dict[int, list[str]] = {}
    for line in text.splitlines():
        line = line.strip()
        m = re.match(r"^(\d+)\.\s+\*\*([^*]+)\*\*", line)
        if not m:
            continue
        qid = int(m.group(1))
        raw = m.group(2).strip()
        if raw in ("对", "错"):
            out[qid] = ["T" if raw == "对" else "F"]
        elif re.fullmatch(r"[A-E]+", raw):
            out[qid] = list(raw)
        elif re.fullmatch(r"[A-E]", raw):
            out[qid] = [raw]
        else:
            raise ValueError(f"无法解析: {line}")
    return out


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    official = parse_source(text)
    qs = json.loads(QS.read_text(encoding="utf-8"))
    by_id = {q["id"]: q for q in qs}

    missing: list[int] = []
    type_mismatch: list[tuple[int, str, str]] = []

    for qid, ans in official.items():
        q = by_id.get(qid)
        if not q:
            missing.append(qid)
            continue
        if q["type"] == "single" and len(ans) != 1:
            type_mismatch.append((qid, q["type"], str(ans)))
        if q["type"] == "judge" and ans not in (["T"], ["F"]):
            type_mismatch.append((qid, q["type"], str(ans)))
        if q["type"] == "multi" and len(ans) < 2:
            pass  # 499 题为双选
        q["answer"] = ans
        q["explanation"] = "official"

    if missing:
        print("警告：答案表中有题库不存在的 id:", missing)
    if type_mismatch:
        print("警告：题型与答案形态可能不符:", type_mismatch)

    # 单选 id 164-350：用户未提供官方表，保留原答案并标记
    for q in qs:
        if q["type"] != "single":
            continue
        if 164 <= q["id"] <= 350 and q["id"] not in official:
            q["explanation"] = "predicted"

    QS.write_text(json.dumps(qs, ensure_ascii=False, indent=2), encoding="utf-8")

    official_ids = set(official)
    print("official entries:", len(official_ids))
    print("updated official in json:", sum(1 for q in qs if q.get("explanation") == "official"))
    print("still predicted (single 164-350):", sum(1 for q in qs if q.get("explanation") == "predicted"))


if __name__ == "__main__":
    main()
