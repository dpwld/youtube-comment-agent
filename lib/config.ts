import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type Config = {
  profiles: string[];
  comment: { min_chars: number; max_chars: number; brand: string };
  limits: { daily_max_comments: number };
  search: { keywords: string[]; rising_keyword: string; max_results: number };
  model: string;
  data_dir: string;
};

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  const file = path.join(process.cwd(), "agent.config.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Config;
  raw.data_dir = (process.env.YT_AGENT_DATA_DIR ?? raw.data_dir).replace(/^~(?=$|\/)/, homedir());
  cached = raw;
  return raw;
}

export function dataDir(): string {
  return loadConfig().data_dir;
}

export function profileDir(name: string): string {
  return path.join(dataDir(), "profiles", name);
}

export function screenshotsDir(): string {
  return path.join(dataDir(), "screenshots");
}
