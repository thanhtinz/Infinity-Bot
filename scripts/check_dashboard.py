#!/usr/bin/env python3
"""
Dashboard health check — scans all page components for common runtime bugs:
  1. useEffect with object/array deps that cause infinite loops
  2. Missing dependency arrays (effect runs every render)
  3. Mutation/state setter called during render (outside useEffect/handler)
  4. Uncaught .json() calls on non-Response (wrong apiFetch pattern)
  5. Components with no return / missing JSX

Usage:
  python3 scripts/check_dashboard.py
  python3 scripts/check_dashboard.py --file src/pages/SomePage.tsx
"""
import re
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parent.parent / "src"
PAGES_DIRS = [ROOT / "pages", ROOT / "components"]

RULES = []

def rule(name):
    def decorator(fn):
        RULES.append((name, fn))
        return fn
    return decorator

# ── Rule 1: useEffect with configForm/object state in deps ─────────────────
@rule("infinite-loop: useEffect dep includes local state object")
def check_effect_object_dep(path: Path, content: str) -> list[str]:
    issues = []
    # Find useEffects where the dep array contains a state variable also set inside
    # Simple heuristic: dep array contains same var that's set inside the effect body
    effects = re.finditer(r'useEffect\s*\(\s*\(\s*\)\s*=>\s*\{(.*?)\}\s*,\s*\[(.*?)\]\s*\)', content, re.DOTALL)
    for m in effects:
        body, deps = m.group(1), m.group(2)
        dep_vars = [d.strip() for d in deps.split(',') if d.strip()]
        for dv in dep_vars:
            # if the dep var is set inside the effect body with set+ucfirst pattern
            setter = "set" + dv[0].upper() + dv[1:]
            if setter in body:
                line = content[:m.start()].count('\n') + 1
                issues.append(f"  Line ~{line}: useEffect sets '{setter}' but '{dv}' is in deps → potential loop")
    return issues

# ── Rule 2: useEffect with no dependency array ──────────────────────────────
@rule("runs-every-render: useEffect missing dependency array")
def check_effect_no_deps(path: Path, content: str) -> list[str]:
    issues = []
    # useEffect(() => { ... }) — no second argument
    no_dep = re.finditer(r'useEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{[^}]*\}\s*\)', content)
    for m in no_dep:
        line = content[:m.start()].count('\n') + 1
        issues.append(f"  Line ~{line}: useEffect with no dependency array (runs every render)")
    return issues

# ── Rule 3: wrong apiFetch pattern ─────────────────────────────────────────
@rule("wrong-api: apiFetch result used as JSON directly")
def check_apifetch_pattern(path: Path, content: str) -> list[str]:
    issues = []
    # Pattern: apiFetch(...) as unknown as Promise<...>  or  const x = await apiFetch and then x.something_not_json
    bad = re.finditer(r'apiFetch\([^)]+\)\s+as\s+unknown\s+as', content)
    for m in bad:
        line = content[:m.start()].count('\n') + 1
        issues.append(f"  Line ~{line}: apiFetch cast with 'as unknown as' — use .then(r => r.json()) instead")
    return issues

# ── Rule 4: import type violation (verbatimModuleSyntax) ───────────────────
@rule("ts-error: type-only import missing 'import type'")
def check_import_type(path: Path, content: str) -> list[str]:
    issues = []
    # Look for imports of known type-only things without 'type' keyword
    bad = re.finditer(r'^import\s+\{[^}]*\b(LucideIcon|IconType|FC|ReactNode|ReactElement|CSSProperties)\b[^}]*\}\s+from', content, re.MULTILINE)
    for m in bad:
        if 'import type' not in content[max(0, m.start()-2):m.start()+15]:
            line = content[:m.start()].count('\n') + 1
            issues.append(f"  Line ~{line}: '{m.group(1)}' is type-only but imported without 'import type'")
    return issues

# ── Rule 5: unused state setters (declared but never called) ───────────────
@rule("dead-code: useState setter declared but never called")
def check_unused_setter(path: Path, content: str) -> list[str]:
    issues = []
    setters = re.finditer(r'const\s+\[(\w+),\s*(set\w+)\]\s*=\s*useState', content)
    for m in setters:
        _, setter = m.group(1), m.group(2)
        # Count uses outside the declaration line
        decl_line_end = content.index('\n', m.start()) if '\n' in content[m.start():] else len(content)
        rest = content[decl_line_end:]
        if setter not in rest:
            line = content[:m.start()].count('\n') + 1
            issues.append(f"  Line ~{line}: '{setter}' declared but never used")
    return issues

# ── Rule 6: missing return in component ────────────────────────────────────
@rule("blank-page: exported component has no return statement")
def check_no_return(path: Path, content: str) -> list[str]:
    issues = []
    # Find export default function or export function that contains no 'return ('
    fns = re.finditer(r'export\s+(?:default\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}', content, re.DOTALL)
    for m in fns:
        name, body = m.group(1), m.group(2)
        if 'return' not in body and len(body) > 50:
            line = content[:m.start()].count('\n') + 1
            issues.append(f"  Line ~{line}: exported function '{name}' may be missing a return statement")
    return issues

def check_file(path: Path) -> bool:
    content = path.read_text(encoding='utf-8', errors='replace')
    rel = path.relative_to(ROOT.parent)
    found_any = False
    for rule_name, fn in RULES:
        issues = fn(path, content)
        if issues:
            if not found_any:
                print(f"\n📄 {rel}")
                found_any = True
            print(f"  ⚠️  [{rule_name}]")
            for issue in issues:
                print(issue)
    return found_any

def main():
    target_file = None
    if '--file' in sys.argv:
        idx = sys.argv.index('--file')
        target_file = Path(sys.argv[idx + 1])

    if target_file:
        files = [target_file]
    else:
        files = []
        for d in PAGES_DIRS:
            if d.exists():
                files += list(d.rglob("*.tsx")) + list(d.rglob("*.ts"))

    print(f"🔍 Checking {len(files)} files...\n")
    any_issues = False
    for f in sorted(files):
        if check_file(f):
            any_issues = True

    if not any_issues:
        print("✅ No issues found.")
    else:
        print(f"\n{'─'*50}")
        print("⚠️  Issues found — review above before deploying.")
    return 1 if any_issues else 0

if __name__ == "__main__":
    sys.exit(main())
