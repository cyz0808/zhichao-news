import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "news.json");

const emptyStore = {
  articles: [],
  digest: [],
  saved: [],
  meta: {
    lastCollectedAt: null,
    lastDigestAt: null,
    feedResults: [],
    mode: "demo"
  }
};

export async function readStore() {
  try {
    return { ...emptyStore, ...JSON.parse(await readFile(dataFile, "utf8")) };
  } catch {
    return structuredClone(emptyStore);
  }
}

export async function writeStore(data) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

export function getDataFile() {
  return dataFile;
}
