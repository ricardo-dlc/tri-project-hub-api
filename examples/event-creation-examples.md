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

## Additional Creation Examples

### Example 4: Relay Event with Auto-injection

```json
POST /events
{
  "title": "City Marathon Relay",
  "type": "running",
  "date": "2024-12-25T09:00:00Z",
  "isTeamEvent": true,
  "isRelay": true,                    // ← Relay-specific field
  "requiredParticipants": 4,
  "maxParticipants": 40,              // ← 40 ÷ 4 = 10 relay teams
  "location": "Downtown Circuit",
  "description": "4-person relay race through the city",
  "distance": "42km total (10.5km per person)",
  "registrationFee": 120.00,
  "registrationDeadline": "2024-12-20T23:59:59Z",
  "difficulty": "advanced",
  "tags": ["relay", "marathon", "team"]
}
```

**System Processing**:
- ✅ `organizerId` auto-injected from user's organizer profile
- ✅ `isRelay: true` preserved (optional field)
- ✅ Team validation: 40 ÷ 4 = 10 teams ✅

### Example 5: Event with All Optional Fields

```json
POST /events
{
  "organizerId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "title": "Complete Event Example",
  "type": "triathlon",
  "date": "2024-12-30T07:00:00Z",
  "isTeamEvent": false,
  "isRelay": false,
  "requiredParticipants": 1,
  "maxParticipants": 150,
  "location": "Lakeside Sports Complex",
  "description": "Olympic distance triathlon with scenic lake views",
  "distance": "1.5km swim, 40km bike, 10km run",
  "registrationFee": 85.00,
  "registrationDeadline": "2024-12-25T23:59:59Z",
  "image": "https://example.com/triathlon-2024.jpg",
  "difficulty": "advanced",
  "tags": ["triathlon", "swimming", "cycling", "running", "olympic-distance"]
}
```

### Example 6: Minimal Required Fields Only

```json
POST /events
{
  "title": "Simple Running Event",
  "type": "running",
  "date": "2024-12-15T08:00:00Z",
  "isTeamEvent": false,
  "requiredParticipants": 1,
  "maxParticipants": 50,
  "location": "City Park",
  "description": "Morning run in the park"
}
```

**System Processing**:
- ✅ `organizerId` auto-injected
- ✅ Optional fields left undefined (not required)
- ✅ `registrationFee` defaults to 0 if not provided
- ✅ `tags` defaults to empty array

## Complex Team Event Examples

### Example 7: Large Team Event

```json
POST /events
{
  "title": "Corporate Challenge - 8 Person Teams",
  "type": "obstacle-course",
  "date": "2024-12-18T10:00:00Z",
  "isTeamEvent": true,
  "requiredParticipants": 8,
  "maxParticipants": 80,              // ← 80 ÷ 8 = 10 corporate teams
  "location": "Adventure Sports Center",
  "description": "Corporate team building obstacle course challenge",
  "distance": "3km obstacle course",
  "registrationFee": 200.00,          // ← Per team registration
  "registrationDeadline": "2024-12-15T23:59:59Z",
  "difficulty": "intermediate",
  "tags": ["corporate", "team-building", "obstacle-course"]
}
```

### Example 8: Small Team Event

```json
POST /events
{
  "title": "Buddy Run - Pairs Only",
  "type": "running",
  "date": "2024-12-12T07:30:00Z",
  "isTeamEvent": true,
  "requiredParticipants": 2,          // ← Pairs/buddy system
  "maxParticipants": 20,              // ← 20 ÷ 2 = 10 pairs
  "location": "Riverside Trail",
  "description": "Partner running event for motivation and safety",
  "distance": "10km",
  "registrationFee": 40.00,
  "difficulty": "beginner",
  "tags": ["running", "buddy-system", "pairs"]
}
```

## Error Prevention Examples

### Example 9: Frontend Validation Helper

```javascript
// Frontend validation before sending request
function validateTeamEvent(isTeamEvent, requiredParticipants, maxParticipants) {
  if (!isTeamEvent) return { valid: true };
  
  if (maxParticipants % requiredParticipants !== 0) {
    const suggestedLower = Math.floor(maxParticipants / requiredParticipants) * requiredParticipants;
    const suggestedHigher = suggestedLower + requiredParticipants;
    
    return {
      valid: false,
      message: `For team events, maxParticipants (${maxParticipants}) must be a multiple of requiredParticipants (${requiredParticipants}).`,
      suggestions: [suggestedLower, suggestedHigher]
    };
  }
  
  return { valid: true };
}

// Usage
const validation = validateTeamEvent(true, 4, 15);
if (!validation.valid) {
  console.error(validation.message);
  console.log('Suggested values:', validation.suggestions); // [12, 16]
}
```

## Migration Notes

- ✅ Existing API calls with `organizerId` continue to work
- ✅ New API calls without `organizerId` get auto-injection
- ✅ Backward compatibility maintained
- ✅ No breaking changes to existing integrations
- ✅ Additional validation for team events (may catch previously invalid data)
- ✅ System-managed fields silently ignored (better UX)
- ✅ Enhanced error messages with suggested values
