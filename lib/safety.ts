/**
 * Content policy, enforced at post time rather than discovered at 50,000 users.
 * Screening is intentionally conservative and explains itself — a student who
 * gets blocked should understand why and be able to rewrite the post.
 */

type Rule = { pattern: RegExp; label: string; explain: string };

const PROHIBITED: Rule[] = [
  {
    pattern: /\b(take|sit|write|do)\s+(my|the|this)\s+(exam|midterm|final|quiz|test)\b|\bexam\s+for\s+me\b|\btake\s*my\s*(exam|test|quiz)\b/i,
    label: "Academic integrity",
    explain:
      "Sidekick allows tutoring, study help and concept explanation. It does not allow paying someone to complete graded work on your behalf.",
  },
  {
    pattern: /\b(write|do|finish|complete)\s+(my|the)\s+(essay|paper|homework|assignment|problem set|pset|lab report)\b/i,
    label: "Academic integrity",
    explain:
      "Post this as tutoring or proofreading instead. Paying someone to produce work you'll submit as your own violates BU's academic conduct code.",
  },
  {
    pattern: /\b(gun|firearm|handgun|ammo|ammunition|silencer)\b/i,
    label: "Weapons",
    explain: "Tasks involving weapons aren't allowed.",
  },
  {
    pattern: /\b(cocaine|adderall|xanax|weed|molly|mdma|lsd|shrooms|percocet|oxy|vape\s*(cart|pen)s?)\b/i,
    label: "Controlled substances",
    explain: "Tasks involving controlled substances aren't allowed.",
  },
  {
    pattern: /\b(buy|get|pick\s*up|deliver)\s+(me\s+)?(alcohol|booze|beer|liquor|vodka|tequila)\b/i,
    label: "Alcohol",
    explain: "Sidekick can't be used to arrange alcohol purchases or deliveries.",
  },
  {
    pattern: /\b(sugar\s*(baby|daddy)|escort|sexual|nudes|onlyfans|strip(per|tease))\b/i,
    label: "Sexual services",
    explain: "Tasks of a sexual nature aren't allowed.",
  },
  {
    pattern: /\b(my|your|the)\s+(bank|venmo|paypal|cash\s*app|zelle)\s+(login|password|account|credentials)\b|\bssn\b|\bsocial security number\b/i,
    label: "Financial account access",
    explain: "Never share financial credentials. Payment runs through Sidekick so you don't have to.",
  },
  {
    pattern: /\b(babysit|watch|pick\s*up)\b[^.]{0,40}\b(my\s+)?(kid|child|children|toddler|infant)\b/i,
    label: "Tasks involving minors",
    explain:
      "Childcare needs background checks Sidekick doesn't run yet. This category is disabled until it does.",
  },
];

export type ScreenResult =
  | { allowed: true }
  | { allowed: false; label: string; explain: string };

export function screenTaskText(...parts: string[]): ScreenResult {
  const text = parts.join(" \n ");
  for (const rule of PROHIBITED) {
    if (rule.pattern.test(text)) {
      return { allowed: false, label: rule.label, explain: rule.explain };
    }
  }
  return { allowed: true };
}

/** Shown on every academic post — the line between help and cheating. */
export const ACADEMIC_NOTICE =
  "Tutoring, study help and concept explanation are welcome. Completing graded work for someone else is not, and gets both accounts removed.";

export const REPORT_REASONS = [
  "Didn't show up",
  "Asked to pay outside Sidekick",
  "Made me uncomfortable",
  "Prohibited task",
  "Spam or scam",
  "Something else",
];
