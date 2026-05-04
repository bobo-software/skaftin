#!/usr/bin/env python3
"""Transform pg_dump (supertokens schema) into idempotent startup baseline SQL (DDL only)."""
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: gen_supertokens_baseline.py <input_dump.sql> <output.sql>", file=sys.stderr)
        return 2
    lines = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace").splitlines()
    out: list[str] = [
        "-- Idempotent baseline for supertokens schema (DDL only, no data).",
        "-- Derived from pg_dump; safe on repeated API boot.",
        "",
    ]

    i = 0
    n = len(lines)
    in_copy = False

    while i < n:
        raw = lines[i]
        s = raw.strip()

        if in_copy:
            if s == r"\.":
                in_copy = False
            i += 1
            continue

        if s.startswith("COPY "):
            in_copy = True
            i += 1
            continue

        if s.startswith("\\restrict") or s.startswith("\\unrestrict"):
            i += 1
            continue
        if s.startswith("SET ") or s.startswith("SELECT pg_catalog"):
            i += 1
            continue
        if "OWNER TO" in raw and ("ALTER TABLE" in raw or "ALTER SCHEMA" in raw):
            i += 1
            continue
        if s == "" or s.startswith("--"):
            i += 1
            continue

        if s.startswith("CREATE SCHEMA supertokens"):
            out.append("CREATE SCHEMA IF NOT EXISTS supertokens;")
            out.append("")
            i += 1
            continue

        if s.startswith("CREATE TABLE supertokens."):
            block = [raw]
            i += 1
            while i < n:
                block.append(lines[i])
                if lines[i].strip().endswith(");"):
                    break
                i += 1
            tbl = "\n".join(block).strip()
            tbl = re.sub(
                r"^CREATE TABLE supertokens\.",
                "CREATE TABLE IF NOT EXISTS supertokens.",
                tbl,
                count=1,
                flags=re.MULTILINE,
            )
            out.append(tbl)
            out.append("")
            i += 1
            continue

        if s.startswith("CREATE INDEX "):
            ln = raw.strip()
            ln = re.sub(r"^CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ", ln, count=1)
            if not ln.endswith(";"):
                ln += ";"
            out.append(ln)
            out.append("")
            i += 1
            continue

        if s.startswith("ALTER TABLE ONLY supertokens."):
            block = [raw]
            i += 1
            while i < n:
                block.append(lines[i])
                if lines[i].strip().endswith(";"):
                    break
                i += 1
            stmt = "\n".join(block).strip()
            if stmt.endswith(";"):
                stmt = stmt[:-1].strip()
            dq = "$SUFT$"
            out.append("DO $$")
            out.append("BEGIN")
            out.append(f"  EXECUTE {dq}{stmt};{dq};")
            out.append("EXCEPTION")
            out.append("  WHEN duplicate_object THEN NULL;")
            out.append("  WHEN duplicate_table THEN NULL;")  # index/constraint backing relation exists
            out.append("  WHEN SQLSTATE '42P16' THEN NULL;")  # multiple PK / invalid_table_definition
            out.append("END $$;")
            out.append("")
            i += 1
            continue

        # Unknown line (e.g. stray blank) — skip
        i += 1

    Path(sys.argv[2]).write_text("\n".join(out) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
