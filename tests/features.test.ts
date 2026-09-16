import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ALL_SKILLS, canonicalSkill, searchSkills, SKILL_GROUPS, MAX_SKILLS } from "../lib/skills";
import { feeBreakdown } from "../lib/pricing";

describe("skill library", () => {
  it("has real breadth across every group", () => {
    assert.ok(ALL_SKILLS.length > 250, `only ${ALL_SKILLS.length} skills`);
    for (const group of SKILL_GROUPS) {
      assert.ok(group.skills.length >= 10, `${group.label} has only ${group.skills.length}`);
    }
  });

  it("contains no duplicates, which would render as repeated chips", () => {
    assert.equal(new Set(ALL_SKILLS).size, ALL_SKILLS.length);
  });

  it("finds skills by prefix and by substring, prefix first", () => {
    const results = searchSkills("chem");
    assert.ok(results.includes("General chemistry"));
    assert.ok(results.includes("Biochemistry"));
    assert.ok(
      results.indexOf("General chemistry") < results.indexOf("Biochemistry"),
      "prefix matches should rank above substring matches",
    );
  });

  it("snaps a known skill to its canonical spelling", () => {
    assert.equal(canonicalSkill("  organic CHEMISTRY "), "Organic chemistry");
  });

  it("keeps an unknown skill so people can add their own", () => {
    assert.equal(canonicalSkill(" Underwater  basket weaving "), "Underwater basket weaving");
  });

  it("caps a custom skill's length rather than storing anything", () => {
    assert.ok(canonicalSkill("x".repeat(200)).length <= 40);
  });

  it("keeps the selection limit small enough to stay meaningful", () => {
    assert.ok(MAX_SKILLS > 5 && MAX_SKILLS <= 20);
  });
});

describe("platform fee", () => {
  it("never pays a tasker less for a higher-priced task", () => {
    let previous = -1;
    for (let cents = 100; cents <= 50_000; cents += 25) {
      const { payout } = feeBreakdown(cents);
      assert.ok(payout >= previous, `payout dropped at ${cents} cents`);
      previous = payout;
    }
  });

  it("charges the reduced rate on small tasks", () => {
    assert.equal(feeBreakdown(1200).fee, 60);
  });

  it("blends toward the standard rate as the price rises", () => {
    assert.equal(feeBreakdown(10_000).fee, 900);
  });
});
