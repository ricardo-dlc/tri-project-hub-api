export interface EventItem {
  id: string;
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
  organizer: {
    name: string;
    contact: string;
    website?: string;
  };
  createdAt: string;
  updatedAt: string;
}
