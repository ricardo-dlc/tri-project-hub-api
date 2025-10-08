# Event Update Examples

This document provides comprehensive examples of how event updates work, including field handling, validation, and role-based permissions.

## Update Field Behavior Summary

| Field | Updates | Notes |
|-------|---------|-------|
| `isFeatured` | Admin only | Silently removed for non-admins |
| `isTeamEvent` | **Ignored** | **Immutable after creation** |
| `currentParticipants` | **Ignored** | Managed by registration system |
| `slug` | **Forbidden** | Throws error if attempted |
| `eventId`, `creatorId`, `createdAt` | **Ignored** | **Silently removed - immutable identifiers** |
| `updatedAt` | **Auto-updated** | Always set to current time |
| Team validation | ✅ Enforced | Uses existing `isTeamEvent` value |

## Basic Update Examples

### Example 1: Simple Field Updates

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "title": "Updated Marathon Event",
  "description": "Join us for an amazing marathon experience",
  "registrationFee": 35.00
}
```

**Result**: Only specified fields are updated, others remain unchanged.

### Example 2: Team Event Capacity Update (Valid)

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "maxParticipants": 24  // Original: requiredParticipants = 4, so 24 ÷ 4 = 6 teams ✅
}
```

**Result**: Update succeeds because 24 is divisible by the existing `requiredParticipants` (4).

### Example 3: Team Event Capacity Update (Invalid)

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "maxParticipants": 22  // Original: requiredParticipants = 4, so 22 ÷ 4 = 5.5 ❌
}
```

**Error Response**:
```json
{
  "statusCode": 400,
  "error": "BadRequestError",
  "message": "For team events, maxParticipants (22) must be a multiple of requiredParticipants (4). Suggested values: 20 or 24",
  "details": {
    "maxParticipants": 22,
    "requiredParticipants": 4,
    "suggestedValues": [20, 24],
    "availableTeamSlots": 5
  }
}
```

## Immutable Field Examples

### Example 4: isTeamEvent Ignored (Immutable)

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "title": "Updated Event",
  "isTeamEvent": true,  // ← This will be silently ignored
  "description": "Updated description"
}
```

**Result**:
- ✅ `title` and `description` updated
- ❌ `isTeamEvent` ignored (remains original value)
- ✅ No error thrown

### Example 5: Team Validation Uses Original isTeamEvent

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "isTeamEvent": false,     // ← Ignored
  "maxParticipants": 15     // ← Still validated against original team event rules
}
```

**Scenario**: Event was originally created as team event with `requiredParticipants: 4`

**Error Response**:
```json
{
  "statusCode": 400,
  "error": "BadRequestError",
  "message": "For team events, maxParticipants (15) must be a multiple of requiredParticipants (4). Suggested values: 12 or 16"
}
```

**Why**: System ignores `isTeamEvent: false` and still validates as team event.

### Example 6: Slug Modification (Forbidden)

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "title": "New Title",
  "slug": "custom-slug"  // ← This will cause an error
}
```

**Error Response**:
```json
{
  "statusCode": 400,
  "error": "BadRequestError",
  "message": "Event slug cannot be modified after creation"
}
```

## Role-Based Permission Examples

### Example 7: Non-Admin isFeatured (Silently Ignored)

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <organizer-token>
{
  "title": "Featured Event",
  "isFeatured": true,  // ← Silently removed
  "description": "This should be featured"
}
```

**Result**:
- ✅ `title` and `description` updated
- ❌ `isFeatured` ignored (remains original value)
- ✅ No error thrown

### Example 8: Admin isFeatured (Allowed)

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <admin-token>
{
  "title": "Featured Marathon",
  "isFeatured": true,  // ← Processed for admin
  "description": "Now featured on homepage"
}
```

**Result**: All fields updated successfully, event is now featured.

### Example 9: Admin Updating Any Event

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <admin-token>
{
  "isEnabled": false,  // Admin disabling someone else's event
  "isFeatured": false
}
```

**Result**: Admin can update any event, bypassing ownership validation.

## Ignored Fields Examples

### Example 10: Multiple Ignored Fields (Silently Removed)

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "title": "Updated Title",
  "currentParticipants": 50,  // ← Silently ignored
  "eventId": "new-id",        // ← Silently ignored
  "creatorId": "new-creator", // ← Silently ignored
  "createdAt": "2024-01-01",  // ← Silently ignored
  "isTeamEvent": true,        // ← Silently ignored
  "isFeatured": true,         // ← Silently ignored (non-admin)
  "description": "Updated description"
}
```

**Result**:
- ✅ Only `title` and `description` updated
- ❌ All other fields silently ignored (no errors thrown)
- ✅ `updatedAt` automatically set to current time
- ✅ System logs ignored fields for debugging

## Complex Update Scenarios

### Example 11: Team Event - Updating Both Capacity Fields

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "requiredParticipants": 5,
  "maxParticipants": 25  // 25 ÷ 5 = 5 teams ✅
}
```

**Result**: Both fields updated, validation passes.

### Example 12: Team Event - Invalid Combination

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "requiredParticipants": 3,
  "maxParticipants": 20  // 20 ÷ 3 = 6.67 ❌
}
```

**Error Response**:
```json
{
  "statusCode": 400,
  "error": "BadRequestError",
  "message": "For team events, maxParticipants (20) must be a multiple of requiredParticipants (3). Suggested values: 18 or 21"
}
```

## Success Response Examples

### Standard Update Response

```json
{
  "statusCode": 200,
  "body": {
    "event": {
      "eventId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      "title": "Updated Marathon Event", // ← Updated
      "slug": "original-marathon-event",  // ← Unchanged (immutable)
      "isFeatured": false,               // ← Unchanged (non-admin)
      "isTeamEvent": true,               // ← Unchanged (immutable)
      "currentParticipants": 15,         // ← Unchanged (managed separately)
      "maxParticipants": 24,             // ← Updated
      "description": "Updated description", // ← Updated
      "updatedAt": "2024-01-01T11:00:00Z", // ← Auto-updated
      "createdAt": "2024-01-01T10:00:00Z"  // ← Unchanged (immutable)
      // ... other fields
    }
  }
}
```

## Advanced Update Scenarios

### Example 13: Preventing Capacity Reduction Below Current Registrations

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "maxParticipants": 30  // Current registrations: 45 people
}
```

**Error Response**:
```json
{
  "statusCode": 400,
  "error": "BadRequestError",
  "message": "Cannot reduce maxParticipants (30) below current registrations (45). Minimum allowed value: 45",
  "details": {
    "requestedMaxParticipants": 30,
    "currentParticipants": 45,
    "minimumAllowed": 45
  }
}
```

### Example 14: Safe Capacity Increase

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "maxParticipants": 100  // Current registrations: 45 people
}
```

**Result**: ✅ Update succeeds - can always increase capacity above current registrations.

### Example 15: System-Managed Fields with Mixed Valid Updates

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <user-token>
{
  "title": "Updated Event Title",           // ← Valid update
  "description": "New description",         // ← Valid update
  "registrationFee": 30.00,                // ← Valid update
  "eventId": "hack-attempt-123",           // ← Silently ignored
  "creatorId": "different-user",           // ← Silently ignored
  "currentParticipants": 999,              // ← Silently ignored
  "createdAt": "1970-01-01T00:00:00Z",     // ← Silently ignored
  "organizerId": "01BX5ZZKBKACTAV9WEVGEMMVRZ" // ← Valid update (if user has access)
}
```

**Result**:
- ✅ `title`, `description`, `registrationFee`, `organizerId` updated
- ❌ System-managed fields silently ignored
- ✅ No errors thrown, operation succeeds
- ✅ Logs show which fields were ignored

### Example 16: Comprehensive Admin Update

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <admin-token>
{
  "title": "Admin Updated Event",
  "isFeatured": true,                      // ← Admin can modify
  "isEnabled": false,                      // ← Admin can disable
  "maxParticipants": 200,                  // ← Admin can modify capacity
  "registrationDeadline": "2024-12-31T23:59:59Z", // ← Admin can extend deadline
  "eventId": "cannot-change-this",         // ← Still silently ignored (even for admin)
  "creatorId": "cannot-change-this"        // ← Still silently ignored (even for admin)
}
```

**Result**:
- ✅ All valid fields updated (admin privileges)
- ❌ System identifiers still silently ignored (even for admin)
- ✅ Admin can modify `isFeatured` and `isEnabled`

## Error Scenarios

### Ownership Validation

```json
PATCH /events/01ARZ3NDEKTSV4RRFFQ69G5FAV
Authorization: Bearer <different-user-token>
{
  "title": "Hijacked Event"
}
```

**Error Response**:
```json
{
  "statusCode": 403,
  "error": "ForbiddenError",
  "message": "You can only update events you created"
}
```

### Event Not Found

```json
PATCH /events/01NONEXISTENT123456789
Authorization: Bearer <user-token>
{
  "title": "Updated Title"
}
```

**Error Response**:
```json
{
  "statusCode": 404,
  "error": "NotFoundError",
  "message": "Event not found"
}
```

## Best Practices

### For Frontend Applications
- Don't show `isFeatured` toggle to non-admin users
- Don't show `isTeamEvent` toggle in edit forms (immutable)
- Don't show system-managed fields (`eventId`, `creatorId`, `createdAt`, `currentParticipants`)
- Validate team capacity on frontend before sending request
- Show helpful error messages for team validation failures
- Check current registrations before allowing capacity reduction

### For API Clients
- Can safely include ignored fields - they won't cause errors
- Always handle team validation errors gracefully
- Check user role before showing admin-only fields
- Use PATCH for partial updates, not PUT
- Monitor logs for ignored fields to clean up API calls over time

### For Admin Interfaces
- Provide clear controls for `isFeatured` status
- Show which fields are immutable vs editable vs admin-only
- Allow admins to update any event (bypass ownership)
- Display current field values and registration counts clearly
- Show warnings when reducing capacity near current registrations

### For API Integration
- System-managed fields are silently ignored (better UX than errors)
- Only `slug` modification throws an error (critical business rule)
- Team validation always uses existing `isTeamEvent` value
- Capacity reduction is prevented if below current registrations

## Migration Notes

- ✅ Existing update calls continue to work
- ✅ **UX Improvement**: System-managed fields now silently ignored (no more errors)
- ✅ Additional validation for team events (may catch invalid data)
- ✅ New immutable field behavior (`isTeamEvent`)
- ✅ Enhanced role-based permissions
- ✅ Better error messages with suggested values
- ✅ Capacity reduction protection (prevents reducing below current registrations)
- ✅ Comprehensive logging for debugging ignored fields

## Logging and Debugging

When fields are silently ignored, the system logs them for debugging:

```
"Removing eventId from update data - field is immutable after creation"
"Removing creatorId from update data - field is immutable after creation"
"Removing currentParticipants from update data - field is immutable after creation"
"Removed admin-only fields from update data for non-admin user"
```

This helps developers identify unnecessary fields in their API calls while maintaining a smooth user experience.
