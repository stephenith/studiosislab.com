/**
 * BlockRenderer — family-aware headers, section titles, shapes.
 * Agent #239 — automatic contrast on tinted grounds.
 */
import { pickAccessibleTextColor } from "./contrast.js";
import type { PageLayout } from "./PageLayoutEngine.js";
import { resolveRoleSample } from "./SampleContent.js";
import type {
  RenderNode,
  ResolvedSpacing,
  ResolvedTheme,
  ResolvedTypography,
  ResumeJsonInput,
} from "./types.js";

export type BlockRenderContext = {
  section_id: string;
  component: string;
  x: number;
  y: number;
  width: number;
  page_width?: number;
  theme: ResolvedTheme;
  typography: ResolvedTypography;
  spacing: ResolvedSpacing;
  seq: number;
  visual_guidance?: ResumeJsonInput["visual_guidance"];
  layout?: PageLayout;
};

function textHeight(fontSize: number, lineHeight: number, lines = 1): number {
  return Math.ceil(fontSize * lineHeight * lines);
}

export function renderBlock(ctx: BlockRenderContext): {
  node: RenderNode;
  height: number;
} {
  const {
    component,
    x,
    y,
    width,
    theme,
    typography,
    spacing,
    section_id,
    seq,
    visual_guidance,
    layout,
    page_width,
  } = ctx;
  const roleFamily = String(visual_guidance?.role_family ?? "marketing_manager");
  const variant = Number(visual_guidance?.design_variant ?? 0);
  const { sample } = resolveRoleSample({
    roleFamily,
    variant,
    openaiContent:
      visual_guidance?.resume_content ?? visual_guidance?.openai_resume_content,
  });
  const headerSystem = String(
    visual_guidance?.header_system ?? visual_guidance?.header_style ?? "",
  );
  const titleSystem = String(visual_guidance?.section_title_system ?? "uppercase_compact");
  const align = String(visual_guidance?.alignment_system ?? "strict_left");
  const id = `block-${section_id}-${seq}`;
  const children: RenderNode[] = [];
  let cursor = y;
  let sectionIndex = seq;
  // Accent as text on page background must meet AA (shapes keep raw accent)
  const accentText = pickAccessibleTextColor(theme.background ?? "#ffffff", {
    largeText: true,
    preferred: theme.accent,
  }).color;

  const pushText = (
    text: string,
    opts: {
      fontSize: number;
      fontFamily: string;
      fontWeight: number;
      fill: string;
      lineHeight: number;
      lines?: number;
      x?: number;
      width?: number;
      textAlign?: "left" | "center" | "right";
    },
  ) => {
    const h = textHeight(opts.fontSize, opts.lineHeight, opts.lines ?? 1);
    children.push({
      id: `${id}-t${children.length}`,
      kind: "text",
      section: section_id,
      component,
      text,
      x: opts.x ?? x,
      y: cursor,
      width: opts.width ?? width,
      height: h,
      fill: opts.fill,
      fontFamily: opts.fontFamily,
      fontSize: opts.fontSize,
      fontWeight: opts.fontWeight,
      lineHeight: opts.lineHeight,
      textAlign: opts.textAlign ?? "left",
    });
    cursor += h;
  };

  const pushRect = (
    rx: number,
    ry: number,
    w: number,
    h: number,
    fill: string,
    role: string,
    radius = 0,
  ) => {
    children.push({
      id: `${id}-r${children.length}`,
      kind: "rect",
      section: section_id,
      component,
      role,
      x: rx,
      y: ry,
      width: w,
      height: h,
      fill,
      rx: radius,
      ry: radius,
    });
  };

  const pushCircle = (cx: number, cy: number, r: number, fill: string) => {
    children.push({
      id: `${id}-c${children.length}`,
      kind: "circle",
      section: section_id,
      component,
      role: "section-marker",
      x: cx,
      y: cy,
      width: r * 2,
      height: r * 2,
      fill,
    });
  };

  const pushHeading = (label: string) => {
    const gapAfter = spacing.paragraph_gap_px;
    if (titleSystem === "filled_label") {
      const h = textHeight(typography.scale_pt.heading, typography.line_height.heading) + 10;
      const labelBg = theme.accent;
      const labelFg = pickAccessibleTextColor(labelBg, {
        largeText: true,
        preferred: theme.on_accent ?? "#ffffff",
      }).color;
      pushRect(x, cursor, Math.min(160, width * 0.45), h, labelBg, "filled-label", 3);
      const saved = cursor;
      cursor += 5;
      pushText(label, {
        fontSize: typography.scale_pt.heading,
        fontFamily: typography.heading_family,
        fontWeight: typography.weights.heading,
        fill: labelFg,
        lineHeight: typography.line_height.heading,
        x: x + 10,
        width: width - 10,
      });
      cursor = Math.max(cursor, saved + h) + gapAfter;
      return;
    }
    if (titleSystem === "pale_strip" || titleSystem === "swiss_grid_label") {
      const h = textHeight(typography.scale_pt.heading, typography.line_height.heading) + 8;
      const stripBg = theme.pale_tint ?? theme.rule;
      const stripFg = pickAccessibleTextColor(stripBg, {
        preferred: theme.heading_text,
      }).color;
      pushRect(x, cursor, width, h, stripBg, "pale-strip", 0);
      if (titleSystem === "swiss_grid_label") {
        pushRect(x, cursor, 6, h, theme.accent, "section-marker", 0);
      }
      cursor += 4;
      pushText(label, {
        fontSize: typography.scale_pt.heading,
        fontFamily: typography.heading_family,
        fontWeight: typography.weights.heading,
        fill: stripFg,
        lineHeight: typography.line_height.heading,
        x: x + (titleSystem === "swiss_grid_label" ? 14 : 8),
        width: width - 16,
      });
      cursor += gapAfter;
      return;
    }
    if (titleSystem === "vertical_accent_bar" || titleSystem === "sidebar_label") {
      const h = textHeight(typography.scale_pt.heading, typography.line_height.heading);
      pushRect(x, cursor, 4, h, theme.accent, "section-marker", 0);
      pushText(label, {
        fontSize: typography.scale_pt.heading,
        fontFamily: typography.heading_family,
        fontWeight: typography.weights.heading,
        fill: theme.heading_text,
        lineHeight: typography.line_height.heading,
        x: x + 12,
        width: width - 12,
      });
      cursor += gapAfter;
      return;
    }
    if (titleSystem === "numbered_marker") {
      const num = String(Math.max(1, sectionIndex)).padStart(2, "0");
      pushText(`${num}  ${label}`, {
        fontSize: typography.scale_pt.heading,
        fontFamily: typography.heading_family,
        fontWeight: typography.weights.heading,
        fill: theme.heading_text,
        lineHeight: typography.line_height.heading,
      });
      children.push({
        id: `${id}-rule`,
        kind: "rule",
        role: "accent-bar",
        section: section_id,
        component: "AccentRule",
        x,
        y: cursor + 2,
        width,
        height: 1.5,
        fill: theme.accent,
      });
      cursor += 8 + gapAfter;
      return;
    }
    if (titleSystem === "geometric_marker") {
      pushCircle(x, cursor + 4, 4, theme.accent);
      pushText(label, {
        fontSize: typography.scale_pt.heading,
        fontFamily: typography.heading_family,
        fontWeight: typography.weights.heading,
        fill: theme.heading_text,
        lineHeight: typography.line_height.heading,
        x: x + 14,
        width: width - 14,
      });
      cursor += gapAfter;
      return;
    }
    if (titleSystem === "full_width_divider" || titleSystem === "text_short_rule") {
      pushText(label, {
        fontSize: typography.scale_pt.heading,
        fontFamily: typography.heading_family,
        fontWeight: typography.weights.heading,
        fill: theme.heading_text,
        lineHeight: typography.line_height.heading,
      });
      const ruleW = titleSystem === "full_width_divider" ? width : Math.min(120, width * 0.3);
      children.push({
        id: `${id}-rule`,
        kind: "rule",
        role: "accent-bar",
        section: section_id,
        component: "AccentRule",
        x,
        y: cursor + 3,
        width: ruleW,
        height: 2,
        fill: theme.accent,
      });
      cursor += 8 + gapAfter;
      return;
    }
    // uppercase_compact default
    pushText(label, {
      fontSize: typography.scale_pt.heading,
      fontFamily: typography.heading_family,
      fontWeight: typography.weights.heading,
      fill: theme.heading_text,
      lineHeight: typography.line_height.heading,
    });
    cursor += gapAfter;
  };

  const pushRole = (role: (typeof sample.roles)[number], bulletMax?: number) => {
    pushText(`${role.title} — ${role.company}`, {
      fontSize: typography.scale_pt.body,
      fontFamily: typography.body_family,
      fontWeight: typography.weights.heading,
      fill: theme.body_text,
      lineHeight: typography.line_height.body,
    });
    cursor += 2;
    pushText(role.dates, {
      fontSize: typography.scale_pt.meta,
      fontFamily: typography.body_family,
      fontWeight: typography.weights.body,
      fill: theme.muted,
      lineHeight: typography.line_height.body,
    });
    cursor += spacing.item_gap_px / 2;
    const sidebarDense =
      String(visual_guidance?.sidebar_policy ?? "") === "narrow_ats_safe";
    const bullets = role.bullets.slice(0, bulletMax ?? role.bullets.length);
    for (const b of bullets) {
      pushText(`• ${b}`, {
        fontSize: typography.scale_pt.body,
        fontFamily: typography.body_family,
        fontWeight: typography.weights.body,
        fill: theme.body_text,
        lineHeight: typography.line_height.body,
        lines: sidebarDense ? 3 : 2,
      });
      cursor += Math.max(2, spacing.item_gap_px / (sidebarDense ? 2 : 3));
    }
    cursor += spacing.item_gap_px * (sidebarDense ? 1.35 : 1);
  };

  switch (component) {
    case "HeaderBlock": {
      const pageW = page_width ?? layout?.width_px ?? width + x * 2;
      const bandH = layout?.header_band_height ?? 0;
      const onBand =
        headerSystem === "dark_band_full" ||
        headerSystem === "muted_band_name_block";
      if (onBand && bandH > 0) {
        const bandFill =
          headerSystem === "dark_band_full"
            ? theme.header_band ?? theme.accent
            : theme.header_band ?? theme.pale_tint ?? "#f1f5f9";
        pushRect(0, 0, pageW, bandH, bandFill, "header-band", 0);
        // Keep band text inside safe top (≥48) for margin probes
        cursor = Math.max(28, layout?.safe_area.top ?? 48);
        const namePick = pickAccessibleTextColor(bandFill, {
          largeText: true,
          preferred: theme.on_accent ?? theme.heading_text,
        });
        const titlePick = pickAccessibleTextColor(bandFill, {
          largeText: true,
          preferred: theme.accent,
        });
        const contactPick = pickAccessibleTextColor(bandFill, {
          preferred: theme.muted,
        });
        pushText(sample.name, {
          fontSize: typography.scale_pt.name,
          fontFamily: typography.heading_family,
          fontWeight: typography.weights.name,
          fill: namePick.color,
          lineHeight: typography.line_height.heading,
          x: layout?.content_x ?? x,
          width: layout?.content_width ?? width,
        });
        cursor += 4;
        pushText(sample.title, {
          fontSize: typography.scale_pt.heading + 1,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.heading,
          fill: titlePick.color,
          lineHeight: typography.line_height.body,
          x: layout?.content_x ?? x,
          width: layout?.content_width ?? width,
        });
        cursor += 4;
        pushText(sample.contact, {
          fontSize: typography.scale_pt.meta,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.body,
          fill: contactPick.color,
          lineHeight: typography.line_height.body,
          x: layout?.content_x ?? x,
          width: layout?.content_width ?? width,
        });
        cursor = Math.max(cursor + 10, bandH + 8);
        break;
      }

      if (
        headerSystem === "oversized_name_split_contact" ||
        align === "split_header_right_contact"
      ) {
        const leftW = width * 0.58;
        const rightW = width * 0.38;
        const rightX = x + width - rightW;
        pushText(sample.name, {
          fontSize: typography.scale_pt.name,
          fontFamily: typography.heading_family,
          fontWeight: typography.weights.name,
          fill: theme.heading_text,
          lineHeight: typography.line_height.heading,
          width: leftW,
        });
        const afterName = cursor;
        cursor = y + 8;
        pushText(sample.title, {
          fontSize: typography.scale_pt.heading,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.heading,
          fill: accentText,
          lineHeight: typography.line_height.body,
          x: rightX,
          width: rightW,
          textAlign: "right",
        });
        pushText(sample.contact.replace(/ · /g, "\n"), {
          fontSize: typography.scale_pt.meta,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.body,
          fill: theme.muted,
          lineHeight: typography.line_height.body,
          x: rightX,
          width: rightW,
          textAlign: "right",
          lines: 4,
        });
        cursor = Math.max(cursor, afterName) + 10;
        pushCircle(x, cursor, 3, theme.accent);
        children.push({
          id: `${id}-rule`,
          kind: "rule",
          role: "accent-bar",
          section: section_id,
          component: "AccentRule",
          x: x + 12,
          y: cursor + 2,
          width: width - 12,
          height: 2,
          fill: theme.accent,
        });
        cursor += 16;
        break;
      }

      if (headerSystem === "centered_restrained") {
        pushText(sample.name, {
          fontSize: typography.scale_pt.name,
          fontFamily: typography.heading_family,
          fontWeight: typography.weights.name,
          fill: theme.heading_text,
          lineHeight: typography.line_height.heading,
          textAlign: "center",
        });
        cursor += 4;
        pushText(sample.title, {
          fontSize: typography.scale_pt.heading + 1,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.heading,
          fill: accentText,
          lineHeight: typography.line_height.body,
          textAlign: "center",
        });
        cursor += 4;
        pushText(sample.contact, {
          fontSize: typography.scale_pt.meta,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.body,
          fill: theme.muted,
          lineHeight: typography.line_height.body,
          textAlign: "center",
        });
        cursor += 8;
        pushRect(x + width * 0.35, cursor, width * 0.3, 3, theme.accent, "accent-bar", 2);
        cursor += 16;
        break;
      }

      if (headerSystem === "minimal_vertical_accent") {
        pushRect(x - 14, y, 3, 70, theme.accent, "accent-rail", 0);
        pushText(sample.name, {
          fontSize: typography.scale_pt.name,
          fontFamily: typography.heading_family,
          fontWeight: typography.weights.name,
          fill: theme.heading_text,
          lineHeight: typography.line_height.heading,
        });
        cursor += 4;
        pushText(sample.title, {
          fontSize: typography.scale_pt.heading + 1,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.heading,
          fill: theme.heading_text,
          lineHeight: typography.line_height.body,
        });
        cursor += 4;
        pushText(sample.contact, {
          fontSize: typography.scale_pt.meta,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.body,
          fill: theme.muted,
          lineHeight: typography.line_height.body,
        });
        cursor += 14;
        break;
      }

      if (headerSystem === "split_header_meta_column") {
        const leftW = width * 0.62;
        pushText(sample.name, {
          fontSize: typography.scale_pt.name,
          fontFamily: typography.heading_family,
          fontWeight: typography.weights.name,
          fill: theme.heading_text,
          lineHeight: typography.line_height.heading,
          width: leftW,
        });
        pushText(sample.title, {
          fontSize: typography.scale_pt.heading + 1,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.heading,
          fill: accentText,
          lineHeight: typography.line_height.body,
          width: leftW,
        });
        const leftEnd = cursor;
        cursor = y;
        const metaX = x + leftW + 16;
        const metaW = width - leftW - 16;
        pushRect(metaX - 8, y, 2, 64, theme.accent, "section-marker", 0);
        pushText(sample.contact.replace(/ · /g, "\n"), {
          fontSize: typography.scale_pt.meta,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.body,
          fill: theme.muted,
          lineHeight: typography.line_height.body,
          x: metaX,
          width: metaW,
          lines: 4,
        });
        cursor = Math.max(cursor, leftEnd) + 12;
        children.push({
          id: `${id}-rule`,
          kind: "rule",
          role: "accent-bar",
          section: section_id,
          component: "AccentRule",
          x,
          y: cursor,
          width,
          height: 1.5,
          fill: theme.rule ?? theme.accent,
        });
        cursor += 14;
        break;
      }

      // compact_corporate / editorial_title / default stacked
      if (headerSystem === "compact_corporate") {
        pushRect(x, cursor, width, 54, theme.pale_tint ?? "#dbeafe", "pale-strip", 4);
        cursor += 10;
        pushText(sample.name, {
          fontSize: typography.scale_pt.name - 2,
          fontFamily: typography.heading_family,
          fontWeight: typography.weights.name,
          fill: theme.heading_text,
          lineHeight: typography.line_height.heading,
          x: x + 12,
          width: width - 24,
        });
        pushText(`${sample.title}  ·  ${sample.contact}`, {
          fontSize: typography.scale_pt.meta,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.body,
          fill: theme.muted,
          lineHeight: typography.line_height.body,
          x: x + 12,
          width: width - 24,
        });
        cursor += 16;
        break;
      }

      pushText(sample.name, {
        fontSize: typography.scale_pt.name,
        fontFamily: typography.heading_family,
        fontWeight: typography.weights.name,
        fill: theme.heading_text,
        lineHeight: typography.line_height.heading,
      });
      cursor += 4;
      pushText(sample.title, {
        fontSize: typography.scale_pt.heading + 1,
        fontFamily: typography.body_family,
        fontWeight: typography.weights.heading,
        fill: accentText,
        lineHeight: typography.line_height.body,
      });
      cursor += 4;
      pushText(sample.contact, {
        fontSize: typography.scale_pt.meta,
        fontFamily: typography.body_family,
        fontWeight: typography.weights.body,
        fill: theme.muted,
        lineHeight: typography.line_height.body,
      });
      cursor += 8;
      children.push({
        id: `${id}-rule`,
        kind: "rule",
        role: "accent-bar",
        section: section_id,
        component: "AccentRule",
        x,
        y: cursor,
        width: headerSystem === "editorial_title" ? Math.min(160, width * 0.35) : width,
        height: 2.5,
        fill: theme.accent,
      });
      cursor += 16;
      break;
    }
    case "SummaryBlock": {
      pushHeading("SUMMARY");
      const sidebarSummary =
        String(visual_guidance?.sidebar_policy ?? "") === "narrow_ats_safe";
      pushText(sample.summary, {
        fontSize: typography.scale_pt.body,
        fontFamily: typography.body_family,
        fontWeight: typography.weights.body,
        fill: theme.body_text,
        lineHeight: typography.line_height.body,
        lines: sidebarSummary ? 5 : 4,
      });
      break;
    }
    case "ExperienceBlock": {
      pushHeading("EXPERIENCE");
      const dens = String(
        (visual_guidance?.spacing_tokens as { density?: string } | undefined)
          ?.density ?? "standard",
      );
      const sidebar = String(visual_guidance?.sidebar_policy ?? "") === "narrow_ats_safe";
      const level = Number(
        (visual_guidance as { content_level?: number } | undefined)
          ?.content_level ?? 3,
      );
      const roles =
        level <= 1
          ? sample.roles.slice(0, 2)
          : level <= 3
            ? sample.roles.slice(0, Math.min(3, sample.roles.length))
            : sample.roles;
      roles.forEach((role, i) => {
        // content_level drives bullet budget; family density nudges slightly.
        const base =
          i === 0
            ? level >= 4
              ? 5
              : level >= 2
                ? 4
                : 3
            : i === 1
              ? level >= 4
                ? 4
                : level >= 2
                  ? 3
                  : 2
              : level >= 3
                ? 3
                : 2;
        const max =
          dens === "airy" && !sidebar ? Math.max(2, base - 1) : base;
        pushRole(role, max);
      });
      cursor -= spacing.item_gap_px;
      break;
    }
    case "SkillsBlock": {
      pushHeading("SKILLS");
      const sidebar =
        String(visual_guidance?.sidebar_policy ?? "") === "narrow_ats_safe";
      pushText(sample.skills, {
        fontSize: typography.scale_pt.body,
        fontFamily: typography.body_family,
        fontWeight: typography.weights.body,
        fill: theme.body_text,
        lineHeight: typography.line_height.body,
        lines: sidebar ? 6 : 3,
      });
      if (sidebar) {
        cursor += 6;
        pushText(
          "Tools  ·  Documentation  ·  Stakeholder Comms  ·  Process Design",
          {
            fontSize: typography.scale_pt.body,
            fontFamily: typography.body_family,
            fontWeight: typography.weights.body,
            fill: theme.body_text,
            lineHeight: typography.line_height.body,
            lines: 3,
          },
        );
      }
      break;
    }
    case "EducationBlock": {
      pushHeading("EDUCATION");
      for (const line of sample.education) {
        pushText(line, {
          fontSize: typography.scale_pt.body,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.body,
          fill: theme.body_text,
          lineHeight: typography.line_height.body,
        });
        cursor += spacing.paragraph_gap_px / 2;
      }
      break;
    }
    case "CertificationsBlock": {
      pushHeading("CERTIFICATIONS");
      for (const c of sample.certifications ?? ["Professional certification"]) {
        pushText(`• ${c}`, {
          fontSize: typography.scale_pt.body,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.body,
          fill: theme.body_text,
          lineHeight: typography.line_height.body,
        });
        cursor += spacing.item_gap_px / 3;
      }
      break;
    }
    case "ProjectsBlock": {
      pushHeading("PROJECTS");
      const projectFallback = [
        {
          title: `${sample.title} Capability Showcase`,
          detail:
            "Fictional portfolio outcome demonstrating role-specific craft and measurable delivery.",
        },
      ];
      for (const p of sample.projects?.length ? sample.projects : projectFallback) {
        pushText(p.title, {
          fontSize: typography.scale_pt.body,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.heading,
          fill: theme.body_text,
          lineHeight: typography.line_height.body,
        });
        pushText(p.detail, {
          fontSize: typography.scale_pt.body,
          fontFamily: typography.body_family,
          fontWeight: typography.weights.body,
          fill: theme.body_text,
          lineHeight: typography.line_height.body,
          lines: 2,
        });
        cursor += spacing.item_gap_px / 2;
      }
      break;
    }
    case "LanguagesBlock": {
      pushHeading("LANGUAGES");
      pushText(sample.languages ?? "English (Native)", {
        fontSize: typography.scale_pt.body,
        fontFamily: typography.body_family,
        fontWeight: typography.weights.body,
        fill: theme.body_text,
        lineHeight: typography.line_height.body,
      });
      break;
    }
    default: {
      pushHeading(section_id.toUpperCase());
      pushText("Fictional sample section content.", {
        fontSize: typography.scale_pt.body,
        fontFamily: typography.body_family,
        fontWeight: typography.weights.body,
        fill: theme.body_text,
        lineHeight: typography.line_height.body,
      });
    }
  }

  const height = Math.max(0, cursor - y);
  return {
    node: {
      id,
      kind: "block",
      section: section_id,
      component,
      x,
      y,
      width,
      height,
      children,
    },
    height,
  };
}
