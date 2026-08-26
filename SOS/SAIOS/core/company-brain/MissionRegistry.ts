/**
 * Mission Registry — versioned, append-only mission storage (Agents #162/#163).
 * Fixture missions are isolated under missions/fixtures/ and never become current.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
  MissionContract,
  MissionRegistryIndex,
} from "./mission-types.js";
import { resolveRepoRoot } from "./PlanRepository.js";

export function missionLogDir(repoRoot?: string): string {
  return join(
    repoRoot ?? resolveRepoRoot(),
    "SOS/07_LOGS/saios/company-brain/missions",
  );
}

export class MissionRegistry {
  readonly root: string;
  readonly dir: string;
  readonly fixtureDir: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.dir = missionLogDir(this.root);
    this.fixtureDir = join(this.dir, "fixtures");
  }

  ensureDir(fixture = false): void {
    const base = fixture ? this.fixtureDir : this.dir;
    mkdirSync(base, { recursive: true });
    mkdirSync(join(base, "versions"), { recursive: true });
  }

  private base(fixture: boolean): string {
    return fixture ? this.fixtureDir : this.dir;
  }

  private indexPath(fixture = false): string {
    return join(this.base(fixture), "index.json");
  }

  private currentPath(): string {
    return join(this.dir, "current-mission.json");
  }

  private historyPath(fixture = false): string {
    return join(this.base(fixture), "missions.jsonl");
  }

  private missionFile(missionId: string, fixture = false): string {
    return join(this.base(fixture), `${missionId}.json`);
  }

  private versionFile(
    missionId: string,
    version: number,
    fixture = false,
  ): string {
    return join(this.base(fixture), "versions", `${missionId}.v${version}.json`);
  }

  listKnownIds(includeFixtures = true): Set<string> {
    const ids = new Set<string>();
    const main = this.loadIndex(false);
    for (const m of main?.missions ?? []) ids.add(m.mission_id);
    if (includeFixtures) {
      const fix = this.loadIndex(true);
      for (const m of fix?.missions ?? []) ids.add(m.mission_id);
    }
    return ids;
  }

  loadIndex(fixture = false): MissionRegistryIndex | null {
    const p = this.indexPath(fixture);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as MissionRegistryIndex;
    } catch {
      return null;
    }
  }

  get(missionId: string): MissionContract | null {
    for (const fixture of [false, true]) {
      const p = this.missionFile(missionId, fixture);
      if (!existsSync(p)) continue;
      try {
        return JSON.parse(readFileSync(p, "utf8")) as MissionContract;
      } catch {
        /* try next */
      }
    }
    return null;
  }

  getCurrent(): MissionContract | null {
    const p = this.currentPath();
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as MissionContract;
    } catch {
      return null;
    }
  }

  getVersion(
    missionId: string,
    version: number,
    fixture = false,
  ): MissionContract | null {
    const p = this.versionFile(missionId, version, fixture);
    if (!existsSync(p)) {
      // try alternate
      const alt = this.versionFile(missionId, version, !fixture);
      if (!existsSync(alt)) return null;
      try {
        return JSON.parse(readFileSync(alt, "utf8")) as MissionContract;
      } catch {
        return null;
      }
    }
    try {
      return JSON.parse(readFileSync(p, "utf8")) as MissionContract;
    } catch {
      return null;
    }
  }

  search(query: string): MissionContract[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.listAll();
    return this.listAll().filter((m) => {
      const hay = [
        m.mission_id,
        m.mission_name,
        m.founder_objective,
        m.mission_description,
        m.business_goal,
        m.mission_type,
        ...m.mission_tags,
        m.status,
        m.priority,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  listAll(includeFixtures = true): MissionContract[] {
    const out: MissionContract[] = [];
    const loadFrom = (base: string) => {
      if (!existsSync(base)) return;
      const files = readdirSync(base).filter(
        (f) => f.startsWith("mission-") && f.endsWith(".json"),
      );
      for (const f of files) {
        try {
          out.push(
            JSON.parse(readFileSync(join(base, f), "utf8")) as MissionContract,
          );
        } catch {
          /* skip */
        }
      }
    };
    loadFrom(this.dir);
    if (includeFixtures) loadFrom(this.fixtureDir);
    return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  history(fixture = false): MissionContract[] {
    const p = this.historyPath(fixture);
    if (!existsSync(p)) return [];
    return readFileSync(p, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as MissionContract;
        } catch {
          return null;
        }
      })
      .filter((x): x is MissionContract => Boolean(x));
  }

  /**
   * Persist mission as current + versioned snapshot + index + jsonl history.
   * Fixture missions never overwrite current-mission.json.
   */
  save(mission: MissionContract, opts?: { set_current?: boolean }): string[] {
    const fixture = Boolean(mission.fixture);
    this.ensureDir(fixture);
    const paths: string[] = [];
    const relBase = fixture
      ? "SOS/07_LOGS/saios/company-brain/missions/fixtures"
      : "SOS/07_LOGS/saios/company-brain/missions";

    const file = this.missionFile(mission.mission_id, fixture);
    writeFileSync(file, `${JSON.stringify(mission, null, 2)}\n`, "utf8");
    paths.push(`${relBase}/${mission.mission_id}.json`);

    const vfile = this.versionFile(
      mission.mission_id,
      mission.mission_version,
      fixture,
    );
    writeFileSync(vfile, `${JSON.stringify(mission, null, 2)}\n`, "utf8");
    paths.push(
      `${relBase}/versions/${mission.mission_id}.v${mission.mission_version}.json`,
    );

    writeFileSync(this.historyPath(fixture), `${JSON.stringify(mission)}\n`, {
      flag: "a",
      encoding: "utf8",
    });
    paths.push(`${relBase}/missions.jsonl`);

    const setCurrent = opts?.set_current !== false && !fixture;
    if (setCurrent) {
      writeFileSync(
        this.currentPath(),
        `${JSON.stringify(mission, null, 2)}\n`,
        "utf8",
      );
      paths.push("SOS/07_LOGS/saios/company-brain/missions/current-mission.json");
    }

    const prev = this.loadIndex(fixture);
    const entries = [...(prev?.missions ?? [])].filter(
      (m) => m.mission_id !== mission.mission_id,
    );
    entries.unshift({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      mission_name: mission.mission_name,
      status: mission.status,
      priority: mission.priority,
      updated_at: mission.updated_at,
      path: `${relBase}/${mission.mission_id}.json`,
    });

    const index: MissionRegistryIndex = {
      schema_version: "mission-registry-1.0.0",
      updated_at: mission.updated_at,
      current_mission_id: setCurrent
        ? mission.mission_id
        : prev?.current_mission_id ?? null,
      mission_count: entries.length,
      missions: entries,
    };
    writeFileSync(
      this.indexPath(fixture),
      `${JSON.stringify(index, null, 2)}\n`,
      "utf8",
    );
    paths.push(`${relBase}/index.json`);

    return paths;
  }
}
