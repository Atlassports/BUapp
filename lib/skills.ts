/**
 * The skill library.
 *
 * Skills drive "For You" matching, so breadth matters more than tidiness — a
 * student who can't find "Organic chemistry" will skip the step entirely and
 * the matching engine gets nothing. Anything missing can be typed in; custom
 * entries behave exactly like listed ones.
 */

export type SkillGroup = {
  id: string;
  label: string;
  emoji: string;
  skills: string[];
};

export const SKILL_GROUPS: SkillGroup[] = [
  {
    id: "academic-stem",
    label: "Math & Science",
    emoji: "🧪",
    skills: [
      "Calculus I", "Calculus II", "Multivariable calculus", "Linear algebra",
      "Differential equations", "Statistics", "Probability", "Discrete math",
      "General chemistry", "Organic chemistry", "Biochemistry", "Physical chemistry",
      "Physics I", "Physics II", "Quantum mechanics", "Thermodynamics",
      "Biology", "Molecular biology", "Genetics", "Anatomy & physiology",
      "Neuroscience", "Environmental science", "Astronomy", "Geology",
    ],
  },
  {
    id: "academic-humanities",
    label: "Humanities & Social Science",
    emoji: "📚",
    skills: [
      "Essay writing", "Proofreading", "Research help", "Citations & bibliography",
      "History", "Philosophy", "Political science", "Sociology", "Psychology",
      "Anthropology", "Economics", "Microeconomics", "Macroeconomics",
      "Literature", "Creative writing", "Journalism", "Public speaking",
      "Debate", "Law & pre-law", "Ethics",
    ],
  },
  {
    id: "business",
    label: "Business & Finance",
    emoji: "📈",
    skills: [
      "Accounting", "Financial modeling", "Valuation", "Excel", "Google Sheets",
      "PowerPoint", "Pitch decks", "Market research", "Business plans",
      "Bookkeeping", "Tax prep help", "Consulting case prep", "Resume review",
      "Cover letters", "Interview prep", "LinkedIn optimization", "Networking",
    ],
  },
  {
    id: "tech",
    label: "Tech & Coding",
    emoji: "💻",
    skills: [
      "Python", "JavaScript", "TypeScript", "Java", "C++", "C", "R", "MATLAB",
      "SQL", "Swift", "Kotlin", "Go", "Rust", "HTML/CSS",
      "React", "Next.js", "Node.js", "Django", "Flask",
      "Web development", "Mobile app development", "Game development",
      "Data analysis", "Machine learning", "AI tools", "Databases",
      "Computer setup", "Troubleshooting", "PC building", "Networking & WiFi",
      "Printer setup", "Phone repair", "Data recovery", "Cybersecurity",
    ],
  },
  {
    id: "creative-visual",
    label: "Photo & Video",
    emoji: "🎬",
    skills: [
      "Photography", "Portrait photography", "Event photography", "Product photography",
      "Headshots", "Real estate photography", "Drone photography",
      "Videography", "Video editing", "Premiere Pro", "Final Cut Pro", "DaVinci Resolve",
      "CapCut", "After Effects", "Motion graphics", "Color grading",
      "TikTok editing", "Reels & Shorts", "YouTube editing", "Podcast editing",
      "Livestreaming", "Photo retouching", "Lightroom", "Photoshop",
    ],
  },
  {
    id: "creative-design",
    label: "Design & Art",
    emoji: "🎨",
    skills: [
      "Graphic design", "Logo design", "Flyer design", "Poster design",
      "Brand identity", "Illustration", "Digital art", "Figma", "Canva",
      "Adobe Illustrator", "InDesign", "UI/UX design", "Web design",
      "Presentation design", "Social media graphics", "Merch design",
      "Painting", "Drawing", "Sculpture", "Ceramics", "Printmaking",
      "Sewing & alterations", "Fashion styling", "Interior styling",
    ],
  },
  {
    id: "music",
    label: "Music & Audio",
    emoji: "🎵",
    skills: [
      "Guitar", "Piano", "Drums", "Bass", "Violin", "Cello", "Saxophone",
      "Trumpet", "Flute", "Voice & singing", "Music theory", "Songwriting",
      "Music production", "Ableton", "Logic Pro", "FL Studio", "Mixing",
      "Mastering", "Audio engineering", "DJing", "Sound for film",
    ],
  },
  {
    id: "languages",
    label: "Languages",
    emoji: "🗣️",
    skills: [
      "Spanish", "French", "Mandarin", "Cantonese", "Japanese", "Korean",
      "German", "Italian", "Portuguese", "Russian", "Arabic", "Hebrew",
      "Hindi", "Urdu", "Vietnamese", "Thai", "Turkish", "Greek", "Latin",
      "ASL", "ESL tutoring", "Translation", "Interpretation",
    ],
  },
  {
    id: "physical",
    label: "Physical & Hands-on",
    emoji: "💪",
    skills: [
      "Heavy lifting", "Furniture assembly", "IKEA assembly", "Moving help",
      "Packing", "Cleaning", "Deep cleaning", "Laundry", "Organizing",
      "Basic handyman", "Painting walls", "Hanging shelves", "TV mounting",
      "Bike repair", "Car maintenance", "Snow shoveling", "Yard work",
      "Gardening", "Plant care",
    ],
  },
  {
    id: "driving",
    label: "Driving & Delivery",
    emoji: "🚗",
    skills: [
      "Driving", "Airport runs", "Furniture transport", "Grocery runs",
      "Food delivery", "Package delivery", "Moving truck driving",
      "Van driving", "Motorcycle delivery", "Cargo bike delivery",
    ],
  },
  {
    id: "care",
    label: "Care & Pets",
    emoji: "🐾",
    skills: [
      "Dog walking", "Pet sitting", "Cat sitting", "Dog training",
      "Pet grooming", "Aquarium care", "Plant sitting", "House sitting",
      "Elder companionship", "Errand running",
    ],
  },
  {
    id: "events",
    label: "Events & Hospitality",
    emoji: "🎪",
    skills: [
      "Event setup", "Event teardown", "Bartending", "Barista", "Serving",
      "Catering help", "Hosting", "Ticketing & check-in", "Tabling",
      "Flyer distribution", "Brand ambassador", "Promo modeling",
      "MC / hosting", "Party planning", "Decorating",
    ],
  },
  {
    id: "fitness",
    label: "Fitness & Wellness",
    emoji: "🏃",
    skills: [
      "Personal training", "Weightlifting coaching", "Running coaching",
      "Yoga", "Pilates", "Swimming", "Tennis", "Basketball", "Soccer",
      "Hockey", "Rock climbing", "Skiing & snowboarding", "Dance",
      "Martial arts", "Nutrition guidance", "Meditation",
    ],
  },
  {
    id: "media",
    label: "Writing & Social",
    emoji: "✍️",
    skills: [
      "Copywriting", "Content writing", "Blog writing", "Ghostwriting",
      "Social media management", "Instagram growth", "TikTok strategy",
      "Community management", "Email newsletters", "SEO", "Ad copy",
      "Transcription", "Data entry", "Note taking", "Scheduling",
      "Virtual assistance", "Customer support",
    ],
  },
];

/** Flat list of every listed skill, for lookup and validation. */
export const ALL_SKILLS: string[] = SKILL_GROUPS.flatMap((g) => g.skills);

const NORMALIZED = new Map(ALL_SKILLS.map((s) => [s.toLowerCase(), s]));

/** Snaps a typed skill to its canonical spelling when one exists. */
export function canonicalSkill(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, 40);
  return NORMALIZED.get(trimmed.toLowerCase()) ?? trimmed;
}

export function searchSkills(query: string, limit = 40): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const skill of ALL_SKILLS) {
    const lower = skill.toLowerCase();
    if (lower.startsWith(q)) starts.push(skill);
    else if (lower.includes(q)) contains.push(skill);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export const MAX_SKILLS = 15;
