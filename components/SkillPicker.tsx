"use client";

import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { canonicalSkill, MAX_SKILLS, searchSkills, SKILL_GROUPS } from "@/lib/skills";

/**
 * Skills drive matching, so this is built to always have an answer: 274 listed
 * skills across 14 groups, searchable, and anything missing can just be typed.
 */
export function SkillPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);

  const results = useMemo(() => searchSkills(query), [query]);
  const atLimit = selected.length >= MAX_SKILLS;

  function toggle(skill: string) {
    const canonical = canonicalSkill(skill);
    if (selected.includes(canonical)) {
      onChange(selected.filter((s) => s !== canonical));
    } else if (!atLimit) {
      onChange([...selected, canonical]);
    }
  }

  function addCustom() {
    const value = canonicalSkill(query);
    if (!value || selected.includes(value) || atLimit) return;
    onChange([...selected, value]);
    setQuery("");
  }

  const exactExists = results.some((r) => r.toLowerCase() === query.trim().toLowerCase());
  const shown = group ? SKILL_GROUPS.find((g) => g.id === group) : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {selected.map((skill) => (
          <button
            key={skill}
            type="button"
            className="chip chip-active"
            onClick={() => onChange(selected.filter((s) => s !== skill))}
          >
            {skill}
            <span aria-hidden className="ml-0.5 opacity-70">×</span>
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setOpen(true)}>
          + Add skills
        </button>
      </div>
      {selected.length > 0 && (
        <p className="faint mt-2 text-[12px]">
          {selected.length} of {MAX_SKILLS} · tap one to remove it
        </p>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Your skills">
        <input
          className="field text-[15px]"
          placeholder="Search 274 skills, or type your own…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!exactExists) addCustom();
            }
          }}
        />

        {atLimit && (
          <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
            That's the maximum of {MAX_SKILLS}. Remove one to add another — a short, honest list
            matches better than a long one.
          </p>
        )}

        {query.trim() ? (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {results.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  className={`chip ${selected.includes(skill) ? "chip-active" : ""}`}
                  onClick={() => toggle(skill)}
                >
                  {skill}
                </button>
              ))}
            </div>
            {!exactExists && (
              <button
                type="button"
                className="mt-3 w-full rounded-xl border border-dashed px-3 py-2.5 text-[13px] font-semibold hairline"
                onClick={addCustom}
                disabled={atLimit}
              >
                Add “{canonicalSkill(query)}” as your own
              </button>
            )}
            {results.length === 0 && (
              <p className="faint mt-3 text-[12px]">
                Nothing listed matches. Add it yourself — custom skills match exactly like the
                built-in ones.
              </p>
            )}
          </div>
        ) : shown ? (
          <div className="mt-4">
            <button type="button" className="muted mb-3 text-[13px] font-semibold" onClick={() => setGroup(null)}>
              ‹ All categories
            </button>
            <h3 className="mb-2.5 text-[15px] font-bold">
              {shown.emoji} {shown.label}
            </h3>
            <div className="flex flex-wrap gap-2">
              {shown.skills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  className={`chip ${selected.includes(skill) ? "chip-active" : ""}`}
                  onClick={() => toggle(skill)}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {SKILL_GROUPS.map((g) => {
              const chosen = g.skills.filter((s) => selected.includes(s)).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroup(g.id)}
                  className="card flex items-center gap-2 p-3 text-left"
                >
                  <span className="text-lg">{g.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{g.label}</span>
                    <span className="faint block text-[11px]">
                      {chosen > 0 ? `${chosen} selected` : `${g.skills.length} skills`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Sheet>
    </>
  );
}
