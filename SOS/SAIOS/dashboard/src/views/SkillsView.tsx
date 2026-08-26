import { useMemo, useState } from "react";
import type { DashboardSnapshot } from "../data/types";
import {
  Badge,
  EmptyIllustration,
  FilterChipButton,
  FilterChipGroup,
  InfoBanner,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  RuntimeStatusCard,
  SearchBar,
  SecondaryButton,
  SectionCard,
  TimelineCard,
  ToolbarActions,
} from "../design-system";
import { NA, display } from "../lib/display";

type DomainFilter = "all" | "resume" | "website" | "common" | "active" | "disabled";

type Props = {
  snapshot: DashboardSnapshot;
  onSelectSkill: (id: string) => void;
  onRefresh?: () => void;
};

export function SkillsView({ snapshot, onSelectSkill, onRefresh }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DomainFilter>("all");
  const q = query.trim().toLowerCase();
  const top = snapshot.top_bar;
  const skills = snapshot.skills ?? [];

  const counts = useMemo(() => {
    const resume = skills.filter((s) => s.domain === "resume").length;
    const website = skills.filter((s) => s.domain === "website").length;
    const common = skills.filter((s) => s.domain === "common").length;
    const knowledge = skills.filter((s) =>
      s.domain.toLowerCase().includes("knowledge"),
    ).length;
    const brain = skills.filter((s) =>
      s.domain.toLowerCase().includes("brain"),
    ).length;
    const active = skills.filter((s) => s.active).length;
    const disabled = skills.filter((s) => !s.active).length;
    return {
      resume,
      website,
      common,
      knowledge,
      brain,
      active,
      disabled,
      total: snapshot.skill_count ?? skills.length,
    };
  }, [skills, snapshot.skill_count]);

  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      if (filter === "resume" && s.domain !== "resume") return false;
      if (filter === "website" && s.domain !== "website") return false;
      if (filter === "common" && s.domain !== "common") return false;
      if (filter === "active" && !s.active) return false;
      if (filter === "disabled" && s.active) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        (s.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [skills, filter, q]);

  const skillEvents = useMemo(() => {
    return (snapshot.activity ?? [])
      .filter((e) => {
        const blob = `${e.event_type} ${e.summary} ${e.department}`.toLowerCase();
        return (
          blob.includes("skill") ||
          blob.includes("registered") ||
          blob.includes("invok")
        );
      })
      .slice(0, 12)
      .map((e) => ({
        id: e.id,
        title: e.summary || e.event_type,
        timestamp: e.timestamp || NA,
        body: `${e.event_type} · ${e.department} · ${e.status}`,
        severity:
          e.status === "fail" || e.status === "failed" || e.status === "blocked"
            ? ("error" as const)
            : e.status === "completed"
              ? ("ok" as const)
              : ("info" as const),
      }));
  }, [snapshot.activity]);

  const filterChips: Array<{ id: DomainFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "resume", label: "Resume" },
    { id: "website", label: "Website" },
    { id: "common", label: "Common" },
    { id: "active", label: "Active" },
    { id: "disabled", label: "Disabled" },
  ];

  return (
    <div className="ds-command">
      <PageHeader
        title="Skills Library"
        subtitle="Manage registered skills and monitor operational readiness."
        actions={
          <ToolbarActions>
            <SearchBar
              value={query}
              placeholder="Search skills…"
              aria-label="Search"
              onChange={setQuery}
            />
            <SecondaryButton size="sm" onClick={() => onRefresh?.()}>
              Refresh
            </SecondaryButton>
            <FilterChipGroup aria-label="Skill filters">
              {filterChips.map((chip) => (
                <FilterChipButton
                  key={chip.id}
                  id={chip.id}
                  label={chip.label}
                  active={filter === chip.id}
                  onClick={() => setFilter(chip.id)}
                />
              ))}
            </FilterChipGroup>
          </ToolbarActions>
        }
      />

      <InfoBanner title="Read-only registry">
        LIVE OFF · dry_run · skill execution controls are not available in this
        dashboard
      </InfoBanner>

      <div className="ds-command-main">
        {/* ROW 1 */}
        <PageSection title="Live Status" subtitle="Skills runtime">
          <RuntimeStatusCard
            liveLabel={top.live_label}
            provider={top.provider}
            cost={`$${top.cost_today_usd}`}
            heartbeat={top.heartbeat_age}
            queue={counts.total}
          />
          <MetricGrid>
            <KPIStatCard
              value={counts.total > 0 ? counts.total : NA}
              label="Registered Skills"
              tone="processing"
              icon="▦"
            />
            <KPIStatCard
              value={skills.length ? counts.active : NA}
              label="Active Skills"
              tone="approved"
              icon="▣"
            />
            <KPIStatCard
              value={skills.length ? counts.disabled : NA}
              label="Disabled Skills"
              tone="blocked"
              icon="◌"
            />
            <KPIStatCard
              value={top.live_label}
              label="Runtime Status"
              tone="neutral"
              icon="◇"
            />
            <KPIStatCard
              value={display(top.heartbeat_age)}
              label="Heartbeat"
              tone="neutral"
              icon="♥"
            />
          </MetricGrid>
        </PageSection>

        {/* ROW 2 */}
        <PageSection title="KPI Grid" subtitle="Domain distribution">
          <MetricGrid>
            <KPIStatCard
              value={counts.total > 0 ? counts.total : NA}
              label="Total Skills"
            />
            <KPIStatCard
              value={skills.length ? counts.resume : NA}
              label="Resume Skills"
            />
            <KPIStatCard
              value={skills.length ? counts.website : NA}
              label="Website Skills"
            />
            <KPIStatCard
              value={skills.length ? counts.common : NA}
              label="Common Skills"
            />
            <KPIStatCard
              value={skills.length ? counts.active : NA}
              label="Active"
              tone="approved"
            />
            <KPIStatCard
              value={skills.length ? counts.disabled : NA}
              label="Disabled"
              tone="blocked"
            />
          </MetricGrid>
        </PageSection>

        {/* ROW 3 */}
        <PageSection title="Skills Registry" subtitle="Registered skill cards">
          {filteredSkills.length === 0 ? (
            <EmptyIllustration
              title={NA}
              copy={
                skills.length === 0
                  ? "skills array is empty in the current snapshot."
                  : "No skills match the current search/filter."
              }
            />
          ) : (
            <MetricGrid columns={3}>
              {filteredSkills.map((s) => (
                <SectionCard key={s.id} title={s.name}>
                  <div className="ds-stack-sm">
                    <div className="ds-row-between">
                      <Badge tone={s.active ? "approved" : "blocked"}>
                        {s.active ? "active" : "disabled"}
                      </Badge>
                      <Badge tone="neutral">{s.domain}</Badge>
                    </div>
                    <p className="mono ds-meta-mono">
                      Skill ID: {display(s.id)}
                    </p>
                    <p className="mono muted ds-meta-mono">
                      Department: {display(s.domain)}
                    </p>
                    <p className="mono muted ds-meta-mono">
                      Category: {display(s.domain)}
                    </p>
                    <p className="ds-meta">Last Used: {NA}</p>
                    <p className="ds-meta">
                      Health: {s.active ? "healthy" : "disabled"}
                    </p>
                    {s.notes ? <p className="ds-meta">{s.notes}</p> : null}
                    <SecondaryButton size="sm" onClick={() => onSelectSkill(s.id)}>
                      Inspect Skill
                    </SecondaryButton>
                  </div>
                </SectionCard>
              ))}
            </MetricGrid>
          )}
        </PageSection>

        {/* ROW 4 */}
        <PageSection title="Skill Categories" subtitle="Counts by category">
          <MetricGrid>
            <KPIStatCard
              value={skills.length ? counts.resume : NA}
              label="Resume"
            />
            <KPIStatCard
              value={skills.length ? counts.knowledge : NA}
              label="Knowledge"
            />
            <KPIStatCard
              value={skills.length ? counts.brain : NA}
              label="Brain"
            />
            <KPIStatCard
              value={skills.length ? counts.website : NA}
              label="Website"
            />
            <KPIStatCard
              value={skills.length ? counts.common : NA}
              label="Common"
            />
          </MetricGrid>
        </PageSection>

        {/* ROW 5 */}
        <PageSection
          title="Recent Skill Activity"
          subtitle="Invoked · completed · failed · registered"
        >
          {skillEvents.length === 0 ? (
            <EmptyIllustration
              title={NA}
              copy="No skill-related activity events in the snapshot."
            />
          ) : (
            <TimelineCard
              title="Skill timeline"
              items={skillEvents.map((e) => ({
                id: e.id,
                title: e.title,
                timestamp: e.timestamp,
                body: e.body,
                icon: "✦",
                severity: e.severity,
              }))}
            />
          )}
        </PageSection>
      </div>
    </div>
  );
}
