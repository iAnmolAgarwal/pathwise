import { PreferencesSchema, type Profile, type ProfileOp } from "../schemas";

export function defaultProfile(): Profile {
  return {
    goals: [],
    skills: {},
    preferences: { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" },
  };
}

/**
 * Deterministic application of ProfileOps (§4.2). The LLM and the UI both speak in ops;
 * this is the only code that writes a Profile. Pure: returns a new object.
 * An inferred level never overwrites an assessed one (assessed outranks inferred, §5.5).
 * Throws on a set_preference value that fails the preference schema.
 */
export function applyProfileOps(profile: Profile, ops: ProfileOp[]): Profile {
  const next: Profile = structuredClone(profile);
  for (const op of ops) {
    switch (op.op) {
      case "add_goal":
        next.goals.push(op.goal);
        break;
      case "remove_goal":
        if (op.index < next.goals.length) next.goals.splice(op.index, 1);
        break;
      case "set_skill": {
        const existing = next.skills[op.skillId];
        if (existing?.source === "assessed" && op.source === "inferred") break;
        next.skills[op.skillId] = { level: op.level, source: op.source };
        break;
      }
      case "set_preference": {
        // Re-validate so callers that bypass ProfileOpSchema still cannot corrupt the profile.
        const value = PreferencesSchema.shape[op.key].parse(op.value);
        // Keyed assignment through a typed view of the preferences record.
        (next.preferences as Record<string, unknown>)[op.key] = value;
        break;
      }
      case "avoid": {
        const d = (next.dislikes ??= { catalogIds: [], providers: [], formats: [] });
        pushUnique(d.catalogIds, op.catalogId);
        if (op.provider) pushUnique(d.providers, op.provider);
        if (op.format) pushUnique(d.formats, op.format);
        break;
      }
    }
  }
  return next;
}

function pushUnique<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value);
}
