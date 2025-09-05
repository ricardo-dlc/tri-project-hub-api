export interface EventItem {
  // Primary Key
  id: string;

  // Core event properties
  title: string;
  type: string; // "triathlon" | "running"
  date: string; // ISO 8601 format for sorting
  isFeatured: boolean;
  isTeamEvent: boolean;
  isRelay?: boolean;
  requiredParticipants: number;
  location: string;
  description: string;
  distance: string;
  maxParticipants: number;
  currentParticipants: number;
  registrationFee: number;
  registrationDeadline: string; // ISO 8601 format
  image: string;
  difficulty: string; // "beginner" | "intermediate" | "advanced"
  tags: string[];

  // New properties
  slug: string; // SEO-friendly URL slug
  isEnabled: boolean; // For filtering enabled events

  // Organizer (embedded for single-table design)
  organizer: {
    name: string;
    contact: string;
    website?: string;
  };

  // GSI partition keys (computed attributes)
  typeEnabled: string; // Format: "{type}#{isEnabled}" e.g., "triathlon#true"
  featuredEnabled: string; // Format: "{isFeatured}#{isEnabled}" e.g., "true#true"
  difficultyEnabled: string; // Format: "{difficulty}#{isEnabled}" e.g., "intermediate#true"
  locationEnabled: string; // Format: "{location}#{isEnabled}" e.g., "Santa Monica, CA#true"
  // isEnabled is used directly as partition key in EnabledDateIndex

  // Timestamps for auditing
  createdAt: string;
  updatedAt: string;
}
