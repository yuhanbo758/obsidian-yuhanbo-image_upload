import { readFileSync, writeFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeIfChanged(path, current) {
  if (JSON.stringify(current) === JSON.stringify(readJson(path))) return;
  writeFileSync(path, JSON.stringify(current, null, 2) + "\n", "utf8");
}

function parseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error("Version must use x.y.z format");
  return match.slice(1).map(Number);
}

const mode = process.argv[2];
if (!["--sync-manifest", "--from-package", "--bump-patch"].includes(mode)) {
  throw new Error("Use --sync-manifest, --from-package, or --bump-patch");
}

const manifest = readJson("manifest.json");
const packageInfo = readJson("package.json");
const versions = readJson("versions.json");
let version = mode === "--from-package" ? packageInfo.version : manifest.version;
const [major, minor, patch] = parseVersion(version);
if (mode === "--bump-patch") version = [major, minor, patch + 1].join(".");

// pnpm 锁文件记录依赖解析，项目版本只同步到发布所需的三个 JSON。
manifest.version = packageInfo.version = version;
versions[version] = manifest.minAppVersion;
writeIfChanged("manifest.json", manifest);
writeIfChanged("package.json", packageInfo);
writeIfChanged("versions.json", versions);
console.log(version);
