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
  enabledStatus: string; // Format: "true" or "false" based on isEnabled

  // Timestamps for auditing
  createdAt: string;
  updatedAt: string;
}

const event: EventItem = {
  id: '9',
  title: 'Marathon Relay Championship 2',
  type: 'running',
  date: '2025-11-29T07:00:00.000Z',
  isFeatured: true,
  isTeamEvent: true,
  isRelay: true,
  requiredParticipants: 4,
  location: 'Chicago, IL',
  description:
    "Experience the marathon distance as a team! Four runners each complete approximately 10.5km through Chicago's iconic neighborhoods. Great for mixed-ability teams.",
  distance: '42.2km total (4 x ~10.5km legs)',
  maxParticipants: 200,
  currentParticipants: 124,
  registrationFee: 120,
  registrationDeadline: '2025-05-28T23:59:59.000Z',
  image:
    'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
  difficulty: 'intermediate',
  tags: ['Team Event', 'Relay', 'Marathon', 'Urban Course'],

  slug: 'marathon-relay-championship-2',
  isEnabled: true,

  organizer: {
    name: 'Chicago Running Association',
    contact: 'relay@chicagorunning.org',
    website: 'https://chicagorunning.org',
  },

  typeEnabled: 'running#true',
  featuredEnabled: 'true#true',
  difficultyEnabled: 'intermediate#true',
  locationEnabled: 'Chicago, IL#true',
  enabledStatus: 'true',

  createdAt: '2024-04-28T12:00:00.000Z',
  updatedAt: '2024-04-28T12:00:00.000Z',
};
