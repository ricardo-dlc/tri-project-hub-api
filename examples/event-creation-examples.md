# Event Creation Examples

This document demonstrates how to create events with automatic field handling, validation, and the organizerId auto-injection feature.

## Field Behavior Summary

| Field | Behavior | Notes |
|-------|----------|-------|
| `organizerId` | Optional - auto-injected | Uses user's organizer profile if not provided |
| `isFeatured` | Ignored - always `false` | Only admins can modify via updates |
| `currentParticipants` | Ignored - always `0` | Managed by registration system |
| `slug` | Auto-generated | Based on title, globally unique |
| `isTeamEvent` | Required - immutable | Cannot be changed after creation |
| Team validation | Enforced | `maxParticipants % requiredParticipants === 0` |

## Option 1: Auto-inject organizerId (Recommended)

When users don't provide an `organizerId`, the system automatically finds their organizer profile:

```json
POST /events
{
  "title": "Morning Marathon Training",
  "type": "running",
  "date": "2024-12-15T08:00:00Z",
  "isTeamEvent": false,
  "requiredParticipants": 1,
  "maxParticipants": 50,
  "location": "Central Park, NYC",
  "description": "Join us for an intensive marathon training session",
  "distance": "21km",
  "registrationFee": 25.00,
  "registrationDeadline": "2024-12-10T23:59:59Z",
  "image": "https://example.com/marathon-training.jpg",
  "difficulty": "intermediate",
  "tags": ["running", "marathon", "training"]
}
```

**System Processing:**
- ✅ `organizerId` auto-injected from user's profile
- ✅ `slug` generated as "morning-marathon-training"
- ✅ `isFeatured` set to `false` (ignored if provided)
- ✅ `currentParticipants` set to `0` (ignored if provided)

## Option 2: Team Event Creation

Team events require special validation - `maxParticipants` must be divisible by `requiredParticipants`:

```json
POST /events
{
  "organizerId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "title": "Corporate Team Building Event",
  "type": "obstacle-course",
  "date": "2024-12-20T14:00:00Z",
  "isTeamEvent": true,
  "requiredParticipants": 4,
  "maxParticipants": 20,  // ✅ 20 ÷ 4 = 5 teams
  "location": "Adventure Park",
  "description": "Team building obstacle course challenge",
  "distance": "2km",
  "registrationFee": 75.00,
  "registrationDeadline": "2024-12-15T23:59:59Z",
  "image": "https://example.com/team-building.jpg",
  "difficulty": "beginner",
  "tags": ["team-building", "corporate", "obstacle-course"]
}
```

**Team Event Rules:**
- ✅ `maxParticipants` must be multiple of `requiredParticipants`
- ✅ Available team slots = `maxParticipants ÷ requiredParticipants`
- ❌ Invalid: `maxParticipants: 15, requiredParticipants: 4` (15 ÷ 4 = 3.75)

## Option 3: Fields That Are Ignored

These fields are accepted but ignored during creation:

```json
POST /events
{
  "title": "Test Event",
  "type": "running",
  "date": "2024-12-01T10:00:00Z",
  "isTeamEvent": false,
  "requiredParticipants": 1,
  "maxParticipants": 100,
  "location": "Test Location",
  "description": "Test description",
  "distance": "5km",
  "registrationFee": 25.00,
  "registrationDeadline": "2024-11-25T23:59:59Z",
  "image": "https://example.com/image.jpg",
  "difficulty": "beginner",
  
  // These fields are ignored:
  "isFeatured": true,        // ← Ignored, set to false
  "currentParticipants": 50, // ← Ignored, set to 0
  "slug": "custom-slug",     // ← Ignored, auto-generated
  "eventId": "custom-id",    // ← Ignored, system generated
  "createdAt": "2024-01-01", // ← Ignored, system generated
  "updatedAt": "2024-01-01"  // ← Ignored, system generated
}
```

## Validation Examples

### ✅ Valid Team Event

```json
{
  "title": "4-Person Relay Race",
  "isTeamEvent": true,
  "requiredParticipants": 4,
  "maxParticipants": 16  // 16 ÷ 4 = 4 teams ✅
}
```

### ❌ Invalid Team Event

```json
{
  "title": "Invalid Team Event",
  "isTeamEvent": true,
  "requiredParticipants": 3,
  "maxParticipants": 10  // 10 ÷ 3 = 3.33... ❌
}
```

**Error Response:**
```json
{
  "statusCode": 400,
  "error": "BadRequestError",
  "message": "For team events, maxParticipants (10) must be a multiple of requiredParticipants (3). Suggested values: 9 or 12",
  "details": {
    "maxParticipants": 10,
    "requiredParticipants": 3,
    "suggestedValues": [9, 12],
    "availableTeamSlots": 3
  }
}
```

## Success Response Example

```json
{
  "statusCode": 201,
  "body": {
    "event": {
      "eventId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      "creatorId": "user_123",
      "organizerId": "01BX5ZZKBKACTAV9WEVGEMMVRZ", // Auto-injected
      "title": "Morning Marathon Training",
      "slug": "morning-marathon-training", // Auto-generated
      "type": "running",
      "date": "2024-12-15T08:00:00Z",
      "isFeatured": false, // Always false for new events
      "isTeamEvent": false,
      "requiredParticipants": 1,
      "maxParticipants": 50,
      "currentParticipants": 0, // Always 0 for new events
      "location": "Central Park, NYC",
      "description": "Join us for an intensive marathon training session",
      "distance": "21km",
      "registrationFee": 25.0,
      "registrationDeadline": "2024-12-10T23:59:59Z",
      "image": "https://example.com/marathon-training.jpg",
      "difficulty": "intermediate",
      "tags": ["running", "marathon", "training"],
      "isEnabled": true,
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  }
}
```

## Error Scenarios

### 1. No Organizer Profile (Auto-injection fails)

```json
{
  "statusCode": 400,
  "error": "BadRequestError",
  "message": "No organizer profile found for user. Please create an organizer profile first or provide a valid organizerId."
}
```

### 2. Invalid Team Event Capacity

```json
{
  "statusCode": 400,
  "error": "BadRequestError",
  "message": "For team events, maxParticipants (15) must be a multiple of requiredParticipants (4). Suggested values: 12 or 16"
}
```

### 3. Invalid Organizer ID

```json
{
  "statusCode": 404,
  "error": "NotFoundError",
  "message": "Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAV not found"
}
```

## Admin Privileges

Admins have special capabilities:

```javascript
// Admin can create events for any organizer
const event = await eventService.createEvent(eventData, creatorId, adminUser);
```

**Admin Benefits:**
- ✅ Can use any valid `organizerId`
- ✅ Can create events for other users
- ✅ Still subject to team event validation
- ✅ `isFeatured` still defaults to `false` (can modify via updates)

## Best Practices

1. **Regular Users**: Don't provide `organizerId` - let the system auto-inject
2. **Team Events**: Always validate capacity before sending request
3. **Frontend Apps**: Don't show fields that are ignored (like `isFeatured` toggle)
4. **API Clients**: Can safely include ignored fields - they won't cause errors
5. **Error Handling**: Check for team validation errors and show suggested values

## Migration Notes

- ✅ Existing API calls with `organizerId` continue to work
- ✅ New API calls without `organizerId` get auto-injection
- ✅ Backward compatibility maintained
- ✅ No breaking changes to existing integrations
- ✅ Additional validation for team events (may catch previously invalid data)
