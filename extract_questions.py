#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path


def parse_questions(text: str):
    lines = [line.strip() for line in text.splitlines()]
    section = "single"
    questions = []
    i = 0
    qid = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("一、单选题"):
            section = "single"
            i += 1
            continue
        if line.startswith("二、多选题") or line.startswith("三、多选题") or line.startswith("四、多选题"):
            section = "multi"
            i += 1
            continue
        if line.startswith("二、判断题") or line.startswith("三、判断题"):
            section = "judge"
            i += 1
            continue
        if line != "*":
            i += 1
            continue

        j = i + 1
        while j < len(lines) and lines[j] == "":
            j += 1
        if j >= len(lines):
            break
        stem = lines[j]
        if stem in {"您的姓名：", "手机扫描二维码答题"}:
            i = j + 1
            continue

        # Some questions are labeled inline, e.g. "（）【多选题】"
        q_type = section
        if "【多选题】" in stem:
            q_type = "multi"
        elif "【判断题】" in stem:
            q_type = "judge"
        elif "【单选题】" in stem:
            q_type = "single"

        options = []
        k = j + 1
        while k < len(lines):
            s = lines[k]
            if s == "":
                k += 1
                continue
            if s == "*" or re.match(r"^[一二三四五六七八九十]+、", s):
                break
            m = re.match(r"^([A-H])\.\s*(.+)$", s)
            if m:
                options.append({"key": m.group(1), "text": m.group(2)})
            elif s in {"对", "错"}:
                options.append({"key": "T" if s == "对" else "F", "text": s})
            k += 1

        if options:
            qid += 1
            answer = []
            am = re.search(r"答案[:：]\s*([对错TFABCD]+)", stem)
            if am:
                v = am.group(1)
                if v in {"对", "T"}:
                    answer = ["T"]
                elif v in {"错", "F"}:
                    answer = ["F"]
                else:
                    answer = list(v)
            clean_stem = re.sub(r"（答案[:：]?\s*.*?）", "", stem).strip()
            clean_stem = (
                clean_stem.replace("【多选题】", "")
                .replace("【单选题】", "")
                .replace("【判断题】", "")
                .strip()
            )
            questions.append(
                {
                    "id": qid,
                    "type": q_type,
                    "question": clean_stem,
                    "options": options,
                    "answer": answer,
                    "explanation": "",
                }
            )
        i = k
    return questions


def main():
    if len(sys.argv) < 3:
        print("用法: python3 extract_questions.py <源文本路径> <输出json路径>")
        sys.exit(1)
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    text = src.read_text(encoding="utf-8")
    data = parse_questions(text)
    dst.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已输出 {len(data)} 题 -> {dst}")


if __name__ == "__main__":
    main()
