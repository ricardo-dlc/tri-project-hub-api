# Implementation Plan

- [x] 1. Verify existing infrastructure compatibility

  - Confirm EventsTable's existing CreatorIndex GSI can be reused for organizer Clerk ID lookups
  - Verify single-table design supports both events and organizers
  - No new GSI needed since CreatorIndex already indexes by Clerk user ID
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 2. Create organizer entity and utilities
- [x] 2.1 Create organizer model with ULID validation

  - Implement OrganizerEntity with ElectroDB configuration
  - Add ULID validation for organizerId and clerkId fields
  - Configure indexes to reuse existing CreatorIndex GSI
  - _Requirements: 7.1, 7.4, 5.1, 5.2_

- [x] 2.2 Create organizer data types and interfaces

  - Define OrganizerItem, CreateOrganizerData, and UpdateOrganizerData interfaces
  - Add validation schemas for organizer creation and updates
  - _Requirements: 7.1, 7.4_

- [x] 2.3 Implement organizer utility functions

  - Create generateOrganizerId function using ULID
  - Add organizer validation helpers
  - _Requirements: 7.1, 5.1_

- [x] 2.4 Write unit tests for organizer model

  - Test ULID validation for organizerId and clerkId
  - Test organizer data validation
  - Test ElectroDB entity operations
  - _Requirements: 7.1, 7.4, 5.1_

- [ ] 3. Update event entity model
- [x] 3.1 Migrate event model to use ULID-based composite keys

  - Keep EventEntity using 'id' field for consistency with other models
  - Add ULID validation for eventId field
  - Update composite key configurations to use eventId instead of plain id
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3.2 Add organizer reference to event model

  - Add organizerId field with ULID validation
  - Remove embedded organizer object from event attributes
  - Update composite keys to include organizerDate
  - _Requirements: 1.5, 1.6, 9.1, 9.2, 9.3_

- [x] 3.3 Update event data types and interfaces

  - Update EventItem interface to include organizerId
  - Remove organizer object from CreateEventData and UpdateEventData
  - Add organizerId to CreateEventData interface
  - _Requirements: 1.5, 1.6, 9.1, 9.3_

- [x] 3.4 Write unit tests for updated event model

  - Test ULID validation for eventId and organizerId
  - Test composite key generation
  - Test event-organizer relationship validation
  - _Requirements: 5.1, 5.2, 9.1, 9.2_

- [ ] 4. Implement organizer service layer
- [x] 4.1 Create organizer service with CRUD operations

  - Implement createOrganizer with Clerk ID validation
  - Implement updateOrganizer with ownership validation
  - Implement deleteOrganizer with event dependency checks
  - Implement getOrganizer and getOrganizerByClerkId methods
  - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 4.2 Add organizer ownership validation

  - Implement validateOrganizerOwnership function
  - Add admin override logic for organizer operations
  - _Requirements: 8.1, 8.2, 4.2, 4.3, 4.4_

- [x] 4.3 Implement organizer-event relationship validation

  - Add validation to ensure organizer exists when creating events
  - Add validation to prevent organizer deletion when events exist
  - _Requirements: 9.1, 9.2, 9.5_

- [x] 4.4 Write unit tests for organizer service

  - Test CRUD operations with various user roles
  - Test ownership validation scenarios
  - Test organizer-event relationship constraints
  - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 9.1, 9.2, 9.5_

- [ ] 5. Implement slug generation system
- [x] 5.1 Create unique slug generation utility

  - Implement generateUniqueSlug function with collision detection
  - Add slug validation and sanitization
  - Ensure global uniqueness across all events
  - _Requirements: 1.7, 1.8_

- [x] 5.2 Add slug validation to event operations

  - Integrate slug generation into event creation
  - Prevent slug modification in event updates
  - _Requirements: 1.7, 1.8, 2.6_

- [x] 5.3 Write unit tests for slug generation

  - Test slug uniqueness and collision handling
  - Test special character sanitization
  - Test slug immutability
  - _Requirements: 1.7, 1.8, 2.6_

- [ ] 6. Update event service layer
- [x] 6.1 Update event service to use organizer references

  - Modify createEvent to validate organizerId and link to organizer
  - Update event queries to support organizer relationships
  - Add getEventBySlug method
  - _Requirements: 1.5, 1.6, 9.1, 9.2, 9.3, 9.4_

- [x] 6.2 Implement team event validation

  - Add validateTeamEventCapacity function
  - Integrate team validation into create and update operations
  - _Requirements: 1.3, 2.3, 6.1, 6.2, 6.3, 6.4_

- [x] 6.3 Update event ownership validation

  - Modify validateEventOwnership to work with updated model
  - Ensure admin override functionality works correctly
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.2, 4.3, 4.4_

- [x] 6.4 Write unit tests for updated event service

  - Test event-organizer relationship validation
  - Test team event capacity validation
  - Test ownership validation with new model structure
  - _Requirements: 1.3, 1.5, 1.6, 2.1, 2.3, 6.1, 6.2, 9.1, 9.2_

- [ ] 7. Create organizer API handlers
- [x] 7.1 Implement createOrganizer handler

  - Create POST /organizers endpoint with authentication
  - Add request validation and error handling
  - Integrate with organizer service
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 7.2 Implement updateOrganizer handler

  - Create PUT /organizers/{organizerId} endpoint
  - Add ownership validation and admin override
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 7.3 Implement getOrganizer handlers

  - Create GET /organizers/{organizerId} endpoint
  - Create GET /organizers/me endpoint for current user's organizer
  - _Requirements: 7.1, 8.1_

- [x] 7.4 Implement deleteOrganizer handler

  - Create DELETE /organizers/{organizerId} endpoint
  - Add event dependency validation
  - _Requirements: 8.1, 8.2, 9.5, 10.5_

- [x] 7.5 Write integration tests for organizer handlers

  - Test all CRUD operations with authentication
  - Test error scenarios and validation
  - Test admin vs creator permissions
  - _Requirements: 7.1, 7.2, 8.1, 8.2, 10.1, 10.2, 10.3_

- [ ] 8. Update event API handlers
- [x] 8.1 Update createEvent handler

  - Modify to require organizerId in request body
  - Add organizer existence validation
  - Integrate slug generation
  - Update team event validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

- [x] 8.2 Update updateEvent handler

  - Remove slug from updatable fields
  - Update team event validation for updates
  - Maintain organizer relationship validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 8.3 Update deleteEvent handler

  - Update to work with new event model structure
  - Maintain registration dependency checks
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 8.4 Add getEventBySlug handler

  - Create GET /events/slug/{slug} endpoint
  - Include organizer data in response
  - _Requirements: 9.4_

- [ ] 8.5 Write integration tests for updated event handlers

  - Test all CRUD operations with new model
  - Test organizer relationship validation
  - Test slug-based event retrieval
  - _Requirements: 1.1, 1.3, 1.7, 2.1, 2.3, 3.1, 9.1, 9.4_

- [ ] 9. Update API routing and infrastructure
- [ ] 9.1 Add organizer routes to API configuration

  - Register organizer CRUD endpoints in HttpApiConstruct
  - Configure proper HTTP methods and paths
  - _Requirements: 7.1, 8.1_

- [ ] 9.2 Update event routes for new endpoints

  - Add slug-based event retrieval route
  - Update existing event routes if needed
  - _Requirements: 9.4_

- [ ] 9.3 Deploy updated Lambda functions

  - Deploy updated Lambda functions with organizer support
  - Verify all endpoints are accessible
  - Confirm CreatorIndex GSI works for both events and organizers
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9.4 Write end-to-end tests

  - Test complete event creation workflow with organizer
  - Test organizer management workflows
  - Test error scenarios across the full stack
  - _Requirements: 1.1, 7.1, 8.1, 9.1, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 10. Data migration and cleanup
- [ ] 10.1 Create data migration script

  - Migrate existing events to use ULID format for eventId
  - Extract organizer data from existing events and create organizer entities
  - Update event records to reference organizerId instead of embedded organizer data
  - _Requirements: 5.4, 5.5_

- [ ] 10.2 Validate migrated data

  - Verify all events have valid organizerId references
  - Ensure all slugs are unique and properly formatted
  - Validate ULID formats for all IDs
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [ ] 10.3 Update documentation and examples
  - Update API documentation with new endpoints
  - Add examples for organizer management
  - Document migration process and breaking changes
  - _Requirements: 1.1, 7.1, 8.1_
