#!/usr/bin/env python3
"""Merge 第N题: 答案 from official_answer_v2_source.md into questions.json.

编号规则：题库无「姓名」字段，网站上第1题通常为用户信息；本仓库 id=1 起为正式题目。
源文件中「第N题」与仓库 id 对应关系为：id = N - 1（即 第2题 → id 1，…，第500题 → id 499）。

用法：
  python3 merge_v2_answers.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "official_answer_v2_source.md"
QS = ROOT / "questions.json"


def parse_answer_raw(raw: str, qtype: str) -> list[str]:
    s = raw.strip()
    s = re.sub(r"\s+", "", s)
    if qtype == "judge":
        if "对" in s and "错" not in s[:1]:
            # 防止「对错」连写
            if s.startswith("错"):
                return ["F"]
            if s.startswith("对") or s == "对":
                return ["T"]
        if s.startswith("错") or s == "错":
            return ["F"]
        if s.startswith("对") or s == "对":
            return ["T"]
        raise ValueError(f"判断题答案无法解析: {raw!r}")
    if qtype == "multi":
        for sep in ("、", ",", "，", "；", ";"):
            if sep in s:
                parts = [p.strip() for p in raw.replace(sep, ",").split(",") if p.strip()]
                letters = []
                for p in parts:
                    p = p.strip().upper()
                    if len(p) == 1 and p in "ABCDE":
                        letters.append(p)
                    else:
                        raise ValueError(f"多选题片段异常: {p!r} in {raw!r}")
                return letters
        m = re.fullmatch(r"[A-Ea-e]+", s)
        if not m:
            raise ValueError(f"多选题答案无法解析: {raw!r}")
        return list(s.upper())
    # single
    if len(s) == 1 and s.upper() in "ABCDE":
        return [s.upper()]
    raise ValueError(f"单选题答案无法解析: {raw!r}")


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"找不到源文件：{SRC}\n请把提供的答案全文保存为该文件后再运行。")
    raw_bytes = SRC.read_bytes()
    for enc in ("utf-8-sig", "utf-8", "gb18030", "gbk"):
        try:
            text = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            text = ""
    else:
        raise SystemExit("无法解码答案源文件，请另存为 UTF-8。")
    pairs = re.findall(r"第(\d+)题:\s*([^\n\r]+)", text)
    if not pairs:
        raise SystemExit("未匹配到任何「第N题:」行，请检查文件格式。")
    by_num: dict[int, str] = {}
    for num_s, raw in pairs:
        n = int(num_s)
        if n in by_num and by_num[n] != raw.strip():
            print("警告：题号重复，后者覆盖前者:", n)
        by_num[n] = raw.strip()

    qs = json.loads(QS.read_text(encoding="utf-8"))
    by_id = {q["id"]: q for q in qs}

    missing_nums = []
    errors: list[str] = []
    for qid in range(1, 500):
        num = qid + 1
        raw = by_num.get(num)
        if raw is None:
            missing_nums.append(num)
            continue
        q = by_id[qid]
        try:
            ans = parse_answer_raw(raw, q["type"])
        except Exception as e:  # noqa: BLE001
            errors.append(f"id {qid} (第{num}题): {e}")
            continue
        q["answer"] = ans
        q["explanation"] = "official_v2"

    if errors:
        print("\n".join(errors[:30]))
        if len(errors) > 30:
            print(f"... 另有 {len(errors)-30} 条错误未显示")
        raise SystemExit("解析失败，未写入 questions.json")

    if missing_nums:
        print(f"警告：缺少题号（共 {len(missing_nums)} 个）:", missing_nums[:20], "...")

    QS.write_text(json.dumps(qs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已更新 questions.json，共 {len(by_num)} 条源答案行，题库 id 1–499。")


if __name__ == "__main__":
    main()
