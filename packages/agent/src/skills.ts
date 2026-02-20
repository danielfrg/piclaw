/**
 * Skills - re-exports from @mariozechner/pi-coding-agent
 *
 * Pi provides full skill file discovery, YAML frontmatter parsing,
 * validation, and system prompt formatting per the Agent Skills spec.
 * We re-export the relevant types and functions, plus a thin wrapper
 * that always includes the piclaw config skills directory.
 */

import path from "path"

import { loadSkills as piLoadSkills } from "@mariozechner/pi-coding-agent"

import { paths } from "./config"

export type {
  Skill,
  SkillFrontmatter,
  LoadSkillsResult,
  LoadSkillsFromDirOptions,
  ResourceDiagnostic,
} from "@mariozechner/pi-coding-agent"

export { formatSkillsForPrompt, loadSkillsFromDir } from "@mariozechner/pi-coding-agent"

export interface LoadSkillsOptions {
  /** Additional skill directory paths (files or directories) to scan */
  skillPaths?: string[]
  /** Working directory for resolving relative paths. Default: process.cwd() */
  cwd?: string
}

/** Default skills directory: XDG_CONFIG/piclaw/skills (or data/config/skills in dev) */
const defaultSkillsDir = path.join(paths.config, "skills")

/**
 * Load skills from the default config directory and any additional paths.
 *
 * Always scans `XDG_CONFIG/piclaw/skills` first, then any explicit
 * skillPaths. Uses pi's loadSkills with includeDefaults: false to
 * avoid scanning pi-specific directories.
 */
export function loadSkills(options: LoadSkillsOptions = {}) {
  return piLoadSkills({
    cwd: options.cwd,
    skillPaths: [defaultSkillsDir, ...(options.skillPaths ?? [])],
    includeDefaults: false,
  })
}
