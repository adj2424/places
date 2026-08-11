import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, dirname, sep } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Hexagonal dependency-direction rules. The domain must stay free of I/O so
 * tiling, qualification, and scoring stay testable without a network, and the
 * inbound adapter must reach outbound adapters only through application ports.
 */
const RULES = [
  {
    name: "domain-must-not-import-adapters",
    from: ["domain"],
    forbidden: ["adapters"],
    message: "domain code must not import adapters",
  },
  {
    name: "inbound-must-not-import-outbound",
    from: ["adapters", "inbound"],
    forbidden: ["adapters", "outbound"],
    message: "inbound adapters must reach outbound adapters through a port",
  },
];

const IMPORT_PATTERN =
  /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function segmentsOf(relativePath) {
  return relativePath.split(sep).filter(Boolean);
}

function startsWithSegments(segments, prefix) {
  return prefix.every((part, index) => segments[index] === part);
}

async function collectSourceFiles(root) {
  const found = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        await walk(full);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".mts")) {
        found.push(full);
      }
    }
  }
  await walk(root);
  return found;
}

function extractImports(source) {
  const specifiers = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

/**
 * Returns one entry per violation. An empty array means the source tree obeys
 * every dependency-direction rule.
 */
export async function checkArchitecture(srcRoot) {
  const root = resolve(srcRoot);
  const files = await collectSourceFiles(root);
  const violations = [];

  for (const file of files) {
    const fileSegments = segmentsOf(relative(root, file));
    const applicable = RULES.filter((rule) =>
      startsWithSegments(fileSegments, rule.from),
    );
    if (applicable.length === 0) continue;

    const source = await readFile(file, "utf8");
    for (const specifier of extractImports(source)) {
      if (!specifier.startsWith(".")) continue;
      const targetSegments = segmentsOf(
        relative(root, resolve(dirname(file), specifier)),
      );
      for (const rule of applicable) {
        if (startsWithSegments(targetSegments, rule.forbidden)) {
          violations.push({
            rule: rule.name,
            file: relative(root, file),
            specifier,
            message: rule.message,
          });
        }
      }
    }
  }

  return violations;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const target = process.argv[2] ?? "src";
  const violations = await checkArchitecture(target);
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `${violation.file}: imports "${violation.specifier}" — ${violation.message} (${violation.rule})`,
      );
    }
    console.error(
      `\n${violations.length} dependency-direction violation(s) found.`,
    );
    process.exit(1);
  }
  console.log("Dependency direction OK.");
}
