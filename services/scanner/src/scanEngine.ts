import { SECRET_PATTERNS } from "./patterns/definitions.js";

export interface RawFinding {
  secretType: string;
  filePath: string;
  lineNumber: number;
  snippetObfuscated: string;
  severity: "low" | "medium" | "high" | "critical";
}

function obfuscate(match: string): string {
  if (match.length <= 8) {
    return "*".repeat(match.length);
  }
  const visibleStart = match.slice(0, 4);
  const visibleEnd = match.slice(-4);
  return `${visibleStart}${"*".repeat(match.length - 8)}${visibleEnd}`;
}

function isLikelyTestFile(filePath: string): boolean {
  return /(\.test\.|\.spec\.|\/tests?\/|\/examples?\/|\.example)/i.test(
    filePath
  );
}

export function scanContent(filePath: string, content: string): RawFinding[] {
  const findings: RawFinding[] = [];
  const lines = content.split("\n");

  for (const pattern of SECRET_PATTERNS) {
    lines.forEach((line, index) => {
      const matches = line.matchAll(pattern.regex);
      for (const match of matches) {
        const matchedText = match[0];

        findings.push({
          secretType: pattern.id,
          filePath,
          lineNumber: index + 1,
          snippetObfuscated: obfuscate(matchedText),
          severity: isLikelyTestFile(filePath) ? "low" : pattern.severity,
        });
      }
    });
  }

  return findings;
}