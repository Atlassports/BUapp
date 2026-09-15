/**
 * Seeds a believable BU campus: enough users, open tasks, live threads and
 * completed history that the feed, ranking and reputation surfaces all have
 * something real to render.
 *
 *   npm run db:reset
 */
import { db, id, run } from "../lib/db";
import { PLACE_BY_ID } from "../lib/geo";
import type { CategoryId, TransportId } from "../lib/taxonomy";

const now = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function wipe() {
  for (const table of ["reviews", "messages", "offers", "tasks", "blocks", "reports", "sessions", "verification_codes", "users"]) {
    db.exec(`DELETE FROM ${table}`);
  }
}

type SeedUser = {
  key: string;
  name: string;
  handle: string;
  year: string;
  place: string;
  transport: TransportId[];
  skills: string[];
  bio: string;
  ageDays: number;
};

const USERS: SeedUser[] = [
  { key: "alex", name: "Alex R.", handle: "alexr", year: "2027", place: "allston-pratt", transport: ["walk", "car"], skills: ["Heavy lifting", "Furniture assembly"], bio: "ENG '27. Have a car most weekends — happy to do furniture and airport runs.", ageDays: 210 },
  { key: "priya", name: "Priya N.", handle: "priyan", year: "2026", place: "west", transport: ["walk", "bike", "mbta"], skills: ["Organic chemistry", "Chemistry", "Calculus"], bio: "Pre-med, CAS '26. TA'd CH203 for two semesters.", ageDays: 320 },
  { key: "marcus", name: "Marcus T.", handle: "marcust", year: "2028", place: "warren", transport: ["walk"], skills: ["Video editing", "Photography", "Social media"], bio: "COM '28. Editing reels between classes. Fast turnarounds.", ageDays: 95 },
  { key: "sofia", name: "Sofia L.", handle: "sofial", year: "2027", place: "myles", transport: ["walk", "mbta"], skills: ["Spanish", "Writing"], bio: "CAS '27, Spanish minor. Always down for a quick errand between classes.", ageDays: 150 },
  { key: "dev", name: "Dev P.", handle: "devp", year: "2026", place: "cds", transport: ["walk", "bike"], skills: ["Python", "Web development", "Excel"], bio: "CDS '26. I fix laptops and build small sites.", ageDays: 280 },
  { key: "hannah", name: "Hannah K.", handle: "hannahk", year: "Grad", place: "south", transport: ["walk", "mbta", "rideshare"], skills: ["Statistics", "Writing"], bio: "Grad student, Questrom. Usually free evenings.", ageDays: 400 },
  { key: "jordan", name: "Jordan M.", handle: "jordanm", year: "2029", place: "stuvi", transport: ["walk", "bike"], skills: ["Pet care", "Cooking"], bio: "Sargent '29. West Campus. Dog person.", ageDays: 40 },
  { key: "chen", name: "Chen W.", handle: "chenw", year: "2028", place: "kilachand", transport: ["walk", "mbta"], skills: ["Mandarin", "Graphic design"], bio: "CFA '28. Design work, flyers, posters.", ageDays: 120 },
  { key: "tariq", name: "Tariq B.", handle: "tariqb", year: "2027", place: "brookline", transport: ["walk", "bike", "car"], skills: ["Music production", "Heavy lifting"], bio: "CFA '27, Brookline. Car available weekdays after 4.", ageDays: 190 },
  { key: "emma", name: "Emma D.", handle: "emmad", year: "2026", place: "questrom", transport: ["walk", "mbta"], skills: ["Excel", "Social media"], bio: "Questrom '26. Spreadsheets are genuinely fun to me.", ageDays: 350 },
  { key: "luis", name: "Luis A.", handle: "luisa", year: "2028", place: "fitrec", transport: ["walk", "bike"], skills: ["Photography"], bio: "West Campus. Shoot events and portraits.", ageDays: 88 },
  { key: "nina", name: "Nina S.", handle: "ninas", year: "2027", place: "danielsen", transport: ["walk", "mbta"], skills: ["Physics", "Calculus"], bio: "ENG '27. Physics and math tutoring.", ageDays: 165 },
];

type SeedTask = {
  poster: string;
  title: string;
  body: string;
  category: CategoryId;
  tags: string[];
  place: string;
  transport: TransportId | null;
  minutes: number;
  dueInHours: number | null;
  price: number;
  priceMax?: number;
  type?: "fixed" | "range" | "open";
  postedMinsAgo: number;
};

const TASKS: SeedTask[] = [
  { poster: "sofia", title: "Pick up my package from the Warren mailroom", body: "Medium box, nothing heavy. I'll forward the tracking email. Just need it dropped at the Myles front desk.", category: "errands", tags: ["Package pickup"], place: "warren", transport: "walk", minutes: 25, dueInHours: 2, price: 1500, postedMinsAgo: 4 },
  { poster: "hannah", title: "Need help moving a couch", body: "Second floor walk-up in Allston to a ground floor unit six blocks away. Two people ideal but one strong person with a truck works. I'll help carry.", category: "moving", tags: ["Move furniture", "Heavy lifting", "Car preferred"], place: "allston-pratt", transport: "car", minutes: 120, dueInHours: 54, price: 4000, postedMinsAgo: 38 },
  { poster: "emma", title: "Tutor me in Orgo before Thursday's exam", body: "CH203. Struggling with reaction mechanisms specifically — everything else I'm okay on. Mugar or Zoom, whichever is easier.", category: "academic", tags: ["Tutoring", "Chemistry", "CH203"], place: "mugar", transport: null, minutes: 90, dueInHours: 10, price: 2500, priceMax: 3500, type: "range", postedMinsAgo: 22 },
  { poster: "jordan", title: "Pick up my laundry from West and bring it to Warren", body: "Wash-and-fold is already paid for. Just needs pickup and drop-off — two bags, not heavy.", category: "errands", tags: ["Laundry"], place: "west", transport: "walk", minutes: 30, dueInHours: 3, price: 1200, postedMinsAgo: 11 },
  { poster: "tariq", title: "Edit a 30-second TikTok for my startup", body: "Raw footage is about four minutes. Need it cut to 30s with captions and a trending sound. Vertical, obviously.", category: "creative", tags: ["Video editing", "Social media"], place: "remote", transport: null, minutes: 90, dueInHours: 26, price: 6000, postedMinsAgo: 67 },
  { poster: "dev", title: "Help me carry boxes down from StuVi II", body: "Eight boxes, elevator building, loading into a car downstairs. Should take under an hour.", category: "moving", tags: ["Carry boxes", "Heavy lifting"], place: "stuvi", transport: null, minutes: 45, dueInHours: 5, price: 3000, postedMinsAgo: 95 },
  { poster: "priya", title: "Ride to Logan on Saturday morning", body: "Two suitcases, leaving from South Campus around 6:30 AM. Need someone with a real trunk.", category: "transportation", tags: ["Airport ride", "Car preferred"], place: "south", transport: "car", minutes: 60, dueInHours: 60, price: 5500, postedMinsAgo: 140 },
  { poster: "marcus", title: "Photograph our club's event at the GSU", body: "BU Finance Association spring showcase. Two hours, need about 40 usable shots. You keep credit, we post them.", category: "campus", tags: ["Photography for club", "Student org work"], place: "gsu", transport: null, minutes: 120, dueInHours: 48, price: 10000, postedMinsAgo: 180 },
  { poster: "chen", title: "Assemble an IKEA desk", body: "It's the Bekant. All parts there, I just don't have the patience or the right screwdriver.", category: "moving", tags: ["Assemble furniture"], place: "allston-harvard-ave", transport: null, minutes: 60, dueInHours: 30, price: 3500, postedMinsAgo: 210 },
  { poster: "nina", title: "Grab me a coffee and a bagel from the GSU", body: "Large iced oat latte and an everything bagel with cream cheese. I'm in Mugar on floor 3, I'll Venmo — actually no, through the app.", category: "errands", tags: ["Food pickup"], place: "gsu", transport: "walk", minutes: 20, dueInHours: 1, price: 1000, postedMinsAgo: 2 },
  { poster: "luis", title: "Walk my dog twice this week", body: "Small beagle, very easy. About 25 minutes each walk, flexible on timing as long as it's afternoon.", category: "personal", tags: ["Dog walking", "Pet sitting"], place: "brookline", transport: null, minutes: 30, dueInHours: 28, price: 2000, postedMinsAgo: 260 },
  { poster: "emma", title: "Clean up my spreadsheet formulas", body: "Financial model for a class project. VLOOKUPs are breaking and I can't find why. Screen share works.", category: "tech", tags: ["Spreadsheets", "Excel"], place: "remote", transport: null, minutes: 60, dueInHours: 8, price: 4000, postedMinsAgo: 300 },
  { poster: "hannah", title: "Design a flyer for our GBM", body: "Student org general body meeting. Need something clean — we'll give you the text and colors.", category: "creative", tags: ["Graphic design", "Club work"], place: "remote", transport: null, minutes: 75, dueInHours: 44, price: 3000, postedMinsAgo: 330 },
  { poster: "sofia", title: "Wait in line for the Agganis box office", body: "Tickets go on sale at 10 AM and I have class until 11:15. Worth it to me not to miss out.", category: "errands", tags: ["Waiting in line"], place: "agganis", transport: "walk", minutes: 75, dueInHours: 20, price: 2500, postedMinsAgo: 355 },
  { poster: "dev", title: "Help me practice Spanish conversation", body: "Oral exam next week. Just want an hour of actual back-and-forth with someone fluent.", category: "academic", tags: ["Language practice"], place: "remote", transport: null, minutes: 60, dueInHours: 36, price: 2500, postedMinsAgo: 400 },
  { poster: "jordan", title: "Set up my new printer and fix the WiFi", body: "Nothing connects and I've given up. Should be quick for someone who knows what they're doing.", category: "tech", tags: ["Computer setup", "Troubleshooting"], place: "stuvi", transport: null, minutes: 45, dueInHours: 12, price: 3000, postedMinsAgo: 430 },
  { poster: "tariq", title: "Hand out flyers near Marsh Plaza", body: "Two hours during the lunch rush. We provide the flyers and a folding table.", category: "campus", tags: ["Flyer distribution", "Tabling"], place: "marsh", transport: "walk", minutes: 120, dueInHours: 26, price: 3600, postedMinsAgo: 500 },
  { poster: "priya", title: "Pick up a desk chair I bought off Marketplace", body: "It's in Brighton, seller is flexible on timing. Needs to fit in a car — it doesn't come apart.", category: "transportation", tags: ["Furniture pickup", "Car preferred"], place: "allston-harvard-ave", transport: "car", minutes: 60, dueInHours: 40, price: 0, type: "open", postedMinsAgo: 560 },
  { poster: "chen", title: "Water my plants while I'm home for the weekend", body: "Six plants, instructions on a sticky note. Leaving Friday, back Sunday night.", category: "personal", tags: ["Plant watering"], place: "danielsen", transport: "walk", minutes: 15, dueInHours: 50, price: 1500, postedMinsAgo: 620 },
  { poster: "nina", title: "Proofread my 8-page paper", body: "History seminar. Argument is fine, I need someone to catch grammar and flow issues. Due Monday.", category: "academic", tags: ["Proofreading"], place: "remote", transport: null, minutes: 60, dueInHours: 46, price: 3000, postedMinsAgo: 700 },
  { poster: "marcus", title: "Help run our event table for 3 hours", body: "Saturday at the GSU link. Just talking to people and handing out stickers. Genuinely easy.", category: "campus", tags: ["Event help", "Student org work"], place: "gsu", transport: null, minutes: 180, dueInHours: 58, price: 7500, postedMinsAgo: 780 },
  { poster: "luis", title: "Return two things to the UPS store", body: "Both already boxed and labeled. Closest store is on Comm Ave.", category: "errands", tags: ["Returns"], place: "warren", transport: "walk", minutes: 25, dueInHours: 6, price: 1200, postedMinsAgo: 850 },
  { poster: "emma", title: "Build me a simple one-page site", body: "For a class project. Just needs to look decent and load fast — no backend, no database.", category: "tech", tags: ["Website help", "Coding"], place: "remote", transport: null, minutes: 180, dueInHours: 70, price: 12000, postedMinsAgo: 920 },
  { poster: "hannah", title: "Physics 211 problem set help", body: "Rotational dynamics. I want to understand it, not copy it — walk me through two problems and I can do the rest.", category: "academic", tags: ["Tutoring", "Physics"], place: "cds", transport: null, minutes: 60, dueInHours: 18, price: 3200, postedMinsAgo: 1000 },
];

function insertUsers() {
  const map = new Map<string, string>();
  USERS.forEach((u, i) => {
    const place = PLACE_BY_ID.get(u.place)!;
    const userId = id("usr");
    const created = now - u.ageDays * DAY;
    run(
      `INSERT INTO users (id,email,handle,name,avatar_hue,bio,class_year,home_area,home_lat,home_lng,transport,skills,verified_at,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      `${u.handle}@bu.edu`,
      u.handle,
      u.name,
      (i * 47) % 360,
      u.bio,
      u.year,
      place.area,
      place.lat,
      place.lng,
      u.transport.join(","),
      u.skills.join(","),
      created,
      created,
    );
    map.set(u.key, userId);
  });
  return map;
}

function insertTasks(users: Map<string, string>) {
  const ids: string[] = [];
  for (const t of TASKS) {
    const place = PLACE_BY_ID.get(t.place)!;
    const isRemote = place.id === "remote";
    const taskId = id("tsk");
    const created = now - t.postedMinsAgo * MIN;
    run(
      `INSERT INTO tasks (id,poster_id,title,body,category,tags,price_type,price_min,price_max,place_id,place_label,lat,lng,is_remote,transport_req,est_minutes,due_at,starts_at,status,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'open', ?)`,
      taskId,
      users.get(t.poster)!,
      t.title,
      t.body,
      t.category,
      t.tags.join(","),
      t.type ?? "fixed",
      t.price,
      t.priceMax ?? t.price,
      place.id,
      place.name,
      isRemote ? null : place.lat,
      isRemote ? null : place.lng,
      isRemote ? 1 : 0,
      isRemote ? null : t.transport,
      t.minutes,
      t.dueInHours === null ? null : now + t.dueInHours * HOUR,
      null,
      created,
    );
    ids.push(taskId);
  }
  return ids;
}

/** Offers and threads on a handful of open tasks, so the inbox isn't empty. */
function insertActivity(users: Map<string, string>, taskIds: string[]) {
  const offers: Array<[number, string, number, string]> = [
    [0, "marcus", 1500, "I'm in Warren right now, can grab it in the next 20 minutes."],
    [0, "jordan", 1500, "Free after 4 — happy to do it then if that still works."],
    [1, "alex", 4000, "I have an SUV and I've moved a couch before. Can do Saturday at 2."],
    [1, "tariq", 3500, "I can do $35 if you help carry. I'm five minutes from Pratt St."],
    [2, "priya", 3000, "I TA'd CH203 for two semesters. Mechanisms are exactly what I drill."],
    [4, "marcus", 6000, "Editing reels is most of what I do. Can turn it around tonight."],
    [7, "luis", 10000, "Shot three club events this semester. Portfolio is on my profile."],
  ];

  const offerIds: string[] = [];
  offers.forEach(([taskIdx, userKey, cents, note], i) => {
    const offerId = id("ofr");
    const created = now - (40 - i * 4) * MIN;
    run(
      `INSERT INTO offers (id,task_id,user_id,note,price_cents,status,created_at) VALUES (?,?,?,?,?, 'pending', ?)`,
      offerId,
      taskIds[taskIdx],
      users.get(userKey)!,
      note,
      cents,
      created,
    );
    run(`INSERT INTO messages (id,offer_id,sender_id,body,created_at) VALUES (?,?,?,?,?)`,
      id("msg"), offerId, users.get(userKey)!, note, created);
    offerIds.push(offerId);
  });

  // A live back-and-forth on the couch move.
  const couchOffer = offerIds[2];
  const hannah = users.get("hannah")!;
  const alex = users.get("alex")!;
  [
    [hannah, "That works. It's a second floor walk-up — is that okay?", 30],
    [alex, "Yeah, done plenty of those. Is there a doorway I should measure for?", 26],
    [hannah, "Standard door. I'll be there to help carry.", 22],
  ].forEach(([sender, body, minsAgo]) => {
    run(`INSERT INTO messages (id,offer_id,sender_id,body,created_at,read_at) VALUES (?,?,?,?,?,?)`,
      id("msg"), couchOffer, sender as string, body as string, now - (minsAgo as number) * MIN, now - 20 * MIN);
  });
}

/** Completed history, so ratings and trust scores aren't all blank. */
function insertHistory(users: Map<string, string>) {
  const history: Array<{ poster: string; tasker: string; title: string; cat: CategoryId; cents: number; daysAgo: number; stars: number; note: string; back: string }> = [
    { poster: "sofia", tasker: "alex", title: "Move a dresser to West Campus", cat: "moving", cents: 4500, daysAgo: 12, stars: 5, note: "Showed up early and brought straps. Made it look easy.", back: "Clear instructions and ready to go when I got there." },
    { poster: "emma", tasker: "priya", title: "CH203 tutoring session", cat: "academic", cents: 3000, daysAgo: 9, stars: 5, note: "Explained mechanisms better than lecture did. Booking again before the final.", back: "Came prepared with actual questions, which makes it way more useful." },
    { poster: "tariq", tasker: "marcus", title: "Edit two Instagram Reels", cat: "creative", cents: 7000, daysAgo: 7, stars: 5, note: "Turned both around in a day and the captions were perfect.", back: "Good footage to start with and fast on feedback." },
    { poster: "dev", tasker: "sofia", title: "Package pickup from Warren", cat: "errands", cents: 1500, daysAgo: 6, stars: 5, note: "Fast, friendly, texted when it was at the desk.", back: "Easy pickup, no issues." },
    { poster: "nina", tasker: "jordan", title: "Dog walking, three days", cat: "personal", cents: 6000, daysAgo: 5, stars: 4, note: "Great with the dog. Ten minutes late one day, not a big deal.", back: "Sweetest dog. Would do it again." },
    { poster: "hannah", tasker: "dev", title: "Fix my laptop's WiFi driver", cat: "tech", cents: 3500, daysAgo: 4, stars: 5, note: "Diagnosed it in ten minutes after I'd spent two hours on it.", back: "Straightforward fix, easy to work with." },
    { poster: "chen", tasker: "luis", title: "Headshots for LinkedIn", cat: "creative", cents: 5000, daysAgo: 3, stars: 5, note: "Genuinely good photos. Worth every dollar.", back: "Knew exactly what they wanted, made it quick." },
    { poster: "marcus", tasker: "alex", title: "Airport run to Logan", cat: "transportation", cents: 5500, daysAgo: 2, stars: 5, note: "On time at 6 AM, which is all I needed.", back: "Ready and waiting when I pulled up." },
  ];

  for (const h of history) {
    const posterId = users.get(h.poster)!;
    const taskerId = users.get(h.tasker)!;
    const taskId = id("tsk");
    const created = now - h.daysAgo * DAY;
    const completed = created + 6 * HOUR;
    const place = PLACE_BY_ID.get("warren")!;

    run(
      `INSERT INTO tasks (id,poster_id,title,body,category,tags,price_type,price_min,price_max,place_id,place_label,lat,lng,is_remote,transport_req,est_minutes,due_at,status,assignee_id,agreed_cents,created_at,assigned_at,completed_at)
       VALUES (?,?,?,'',?,'','fixed',?,?,?,?,?,?,0,NULL,60,?, 'completed',?,?,?,?,?)`,
      taskId, posterId, h.title, h.cat, h.cents, h.cents,
      place.id, place.name, place.lat, place.lng,
      completed, taskerId, h.cents, created, created + HOUR, completed,
    );

    const offerId = id("ofr");
    run(`INSERT INTO offers (id,task_id,user_id,note,price_cents,status,created_at) VALUES (?,?,?,'',?, 'accepted', ?)`,
      offerId, taskId, taskerId, h.cents, created + 30 * MIN);

    run(`INSERT INTO reviews (id,task_id,author_id,subject_id,stars,body,would_again,author_role,created_at) VALUES (?,?,?,?,?,?,1,'poster',?)`,
      id("rev"), taskId, posterId, taskerId, h.stars, h.note, completed + HOUR);
    run(`INSERT INTO reviews (id,task_id,author_id,subject_id,stars,body,would_again,author_role,created_at) VALUES (?,?,?,?,5,?,1,'tasker',?)`,
      id("rev"), taskId, taskerId, posterId, h.back, completed + 2 * HOUR);
  }
}

wipe();
const users = insertUsers();
const taskIds = insertTasks(users);
insertActivity(users, taskIds);
insertHistory(users);

console.log(`Seeded ${USERS.length} students, ${TASKS.length} open tasks, plus offers, threads and completed history.`);
console.log(`Sign in as any of: ${USERS.slice(0, 3).map((u) => `${u.handle}@bu.edu`).join(", ")} — the code prints to this console.`);
