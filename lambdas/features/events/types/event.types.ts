export interface EventItem {
  id: string;
  eventId: string;
  creatorId: string;
  organizerId: string;
  title: string;
  type: string;
  date: string;
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
  registrationDeadline: string;
  image: string;
  difficulty: string;
  tags: string[];
  slug: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventData {
  organizerId: string;
  title: string;
  type: string;
  date: string;
  isTeamEvent: boolean;
  isRelay?: boolean;
  requiredParticipants: number;
  maxParticipants: number;
  location: string;
  description: string;
  distance: string;
  registrationFee: number;
  registrationDeadline: string;
  image: string;
  difficulty: string;
  tags?: string[];
}

export interface UpdateEventData {
  title?: string;
  type?: string;
  date?: string;
  isFeatured?: boolean;
  isTeamEvent?: boolean;
  isRelay?: boolean;
  requiredParticipants?: number;
  maxParticipants?: number;
  location?: string;
  description?: string;
  distance?: string;
  registrationFee?: number;
  registrationDeadline?: string;
  image?: string;
  difficulty?: string;
  tags?: string[];
  isEnabled?: boolean;
}

export interface PaginationQueryParams {
  limit?: string;
  nextToken?: string;
}