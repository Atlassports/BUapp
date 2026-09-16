import type { CategoryId, TransportId } from "./taxonomy";

export type User = {
  id: string;
  email: string;
  handle: string;
  name: string;
  avatar_hue: number;
  bio: string;
  class_year: string;
  home_area: string;
  home_lat: number;
  home_lng: number;
  transport: string;
  skills: string;
  verified_at: number | null;
  available_until: number | null;
  created_at: number;
};

export type Task = {
  id: string;
  poster_id: string;
  org_id: string | null;
  title: string;
  body: string;
  category: CategoryId;
  tags: string;
  price_type: "fixed" | "range" | "open";
  price_min: number;
  price_max: number;
  place_id: string;
  place_label: string;
  lat: number | null;
  lng: number | null;
  is_remote: number;
  transport_req: TransportId | null;
  est_minutes: number;
  due_at: number | null;
  starts_at: number | null;
  status: "open" | "assigned" | "completed" | "cancelled";
  assignee_id: string | null;
  agreed_cents: number | null;
  created_at: number;
  assigned_at: number | null;
  completed_at: number | null;
};

export type Offer = {
  id: string;
  task_id: string;
  user_id: string;
  note: string;
  price_cents: number;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  created_at: number;
};

export type Message = {
  id: string;
  offer_id: string;
  sender_id: string;
  body: string;
  created_at: number;
  read_at: number | null;
};

export type Review = {
  id: string;
  task_id: string;
  author_id: string;
  subject_id: string;
  stars: number;
  body: string;
  would_again: number;
  author_role: "poster" | "tasker";
  created_at: number;
};

/** A user with the reputation numbers the UI actually renders. */
export type PublicUser = {
  id: string;
  handle: string;
  name: string;
  avatar_hue: number;
  bio: string;
  class_year: string;
  home_area: string;
  transport: TransportId[];
  skills: string[];
  verified: boolean;
  rating: number | null;
  review_count: number;
  completed_count: number;
  trust_score: number;
  available_until: number | null;
  created_at: number;
};

/** A task joined with everything a feed card needs in one shot. */
export type TaskCard = Task & {
  poster: PublicUser;
  offer_count: number;
  distance_mi: number | null;
  tag_list: string[];
};
