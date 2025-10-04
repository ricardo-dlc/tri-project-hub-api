# Implementation Plan

- [x] 1. Update DynamoDB table infrastructure with new GSIs
  - Modify EventsTable construct to add 4 new GSIs for registration system
  - Update table permissions to include new GSI access patterns
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. Create registration and participant data models
- [x] 2.1 Create registration entity model with ElectroDB and ULID support
  - Define Registration entity with ULID-based reservationId and proper GSI mappings
  - Implement validation for required fields including ULID format validation
  - Write unit tests for registration entity validation and ULID ID generation
  - _Requirements: 1.3, 2.5, 4.1, 6.1, 8.1, 8.2, 8.3_

- [x] 2.2 Create participant entity model with ElectroDB and ULID support
  - Define Participant entity with ULID-based participantId and reservationId references
  - Implement email validation, required field validation, and ULID format validation
  - Write unit tests for participant entity validation and ULID ID handling
  - _Requirements: 1.1, 2.1, 5.1, 5.2, 7.1, 7.2, 8.1, 8.4, 8.5_

- [ ] 3. Implement core registration services
- [x] 3.1 Create email uniqueness validation service
  - Implement function to check email uniqueness per event using EventParticipantIndex
  - Handle both individual and team registration email validation
  - Write unit tests for email validation scenarios including edge cases
  - _Requirements: 1.2, 2.2, 2.3, 5.4_

- [x] 3.2 Create event capacity validation service
  - Implement function to validate event capacity against current participants
  - Check maxParticipants vs currentParticipants + new registration count
  - Write unit tests for capacity validation including boundary conditions
  - _Requirements: 1.4, 2.4, 5.5_

- [x] 3.3 Create ULID-based ID generation service
  - Implement ULID-based reservation ID and participant ID generator
  - Ensure all IDs follow ULID format for consistency and sortability
  - Write unit tests for ULID generation, validation, and uniqueness
  - _Requirements: 1.5, 2.5, 4.4, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 4. Implement individual registration functionality
- [x] 4.1 Create individual registration service with ULID support
  - Implement service to process single participant registrations using ULID IDs
  - Validate email uniqueness, event capacity, required fields, and ULID format
  - Create registration and participant entities with ULID-based linking
  - Write unit tests for successful registration and error scenarios with ULID validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3, 8.4_

- [x] 4.2 Create individual registration API handler with ULID support
  - Implement Lambda handler for POST /events/{eventId}/registrations (individual)
  - Parse and validate request body, validate eventId as ULID format
  - Handle error responses for validation failures, capacity issues, and invalid ULID format
  - Write integration tests for API endpoint with ULID validation scenarios
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.4, 8.5_

- [ ] 5. Implement team registration functionality
- [x] 5.1 Create team registration service with ULID support
  - Implement service to process team participant registrations using ULID IDs
  - Validate no duplicate emails within team and against existing event participants
  - Create single ULID-based registration entity with multiple ULID-based participant entities
  - Write unit tests for team registration validation and ULID-based creation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 8.1, 8.2, 8.3, 8.4_

- [x] 5.2 Create team registration API handler with ULID support
  - Implement Lambda handler for POST /events/{eventId}/registrations (team)
  - Parse and validate request body, validate eventId as ULID format
  - Handle team-specific validation errors, capacity checks, and ULID format validation
  - Write integration tests for team registration API with ULID validation scenarios
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 8.4, 8.5_

- [ ] 6. Implement participant query functionality
- [x] 6.1 Create participant query service
  - Implement service to retrieve participants by event ID for organizers
  - Use EventParticipantIndex to efficiently query participants
  - Include registration and payment status information in response
  - Write unit tests for participant querying and data formatting
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 6.2 Create participant list API handler
  - Implement Lambda handler for GET /events/{eventId}/registrations
  - Validate organizer access (only event creators can view participants)
  - Format response to group participants by reservation ID
  - Write integration tests for organizer access control and data retrieval
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 7. Implement payment status management
- [ ] 7.1 Create payment status update service with ULID support
  - Implement service to update payment status for entire registrations using ULID-based reservation IDs
  - Use ULID-based reservation ID to identify all participants covered by payment
  - Update registration entity payment status and track payment date with ULID validation
  - Write unit tests for payment status updates and ULID validation
  - _Requirements: 4.1, 4.2, 4.4, 4.5, 8.4, 8.5_

- [ ] 7.2 Create payment status API handler with ULID support
  - Implement Lambda handler for PATCH /registrations/{reservationId}/payment with ULID validation
  - Validate payment status transitions (unpaid to paid) and ULID format for reservationId
  - Handle authorization for payment status updates and invalid ULID errors
  - Write integration tests for payment status update scenarios with ULID validation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.4, 8.5_

- [ ] 8. Implement event participant count updates
- [ ] 8.1 Create participant count update service
  - Implement service to update event currentParticipants count after registration
  - Handle both individual and team registration count updates
  - Ensure atomic updates to prevent race conditions
  - Write unit tests for count update logic and edge cases
  - _Requirements: 5.5_

- [ ] 8.2 Integrate participant count updates with registration services
  - Modify registration services to update event participant counts
  - Handle rollback scenarios if registration fails after count update
  - Write integration tests for end-to-end registration with count updates
  - _Requirements: 5.5_

- [ ] 9. Create comprehensive error handling
- [ ] 9.1 Implement registration-specific error classes
  - Create DuplicateEmailError, CapacityExceededError, InvalidEventError classes
  - Implement RegistrationClosedError for deadline validation
  - Write unit tests for error class instantiation and message formatting
  - _Requirements: 5.4_

- [ ] 9.2 Integrate error handling across all registration services
  - Add proper error handling and user-friendly error messages
  - Implement consistent error response formatting
  - Write integration tests for error scenarios across all endpoints
  - _Requirements: 5.4_

- [ ] 10. Add API routes and infrastructure integration
- [ ] 10.1 Create registration API construct
  - Create new CDK construct for registration Lambda functions
  - Configure API Gateway routes for registration endpoints
  - Set up proper IAM permissions for DynamoDB access
  - _Requirements: All API-related requirements_

- [ ] 10.2 Integrate registration APIs with main stack
  - Add registration API construct to main CDK stack
  - Configure environment variables for table names and GSI names
  - Update deployment scripts and documentation
  - _Requirements: All infrastructure requirements_

- [ ] 11. Write comprehensive integration tests
- [ ] 11.1 Create end-to-end registration flow tests
  - Test complete individual registration flow from API to database
  - Test complete team registration flow with multiple participants
  - Test email uniqueness validation across different scenarios
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 11.2 Create organizer workflow integration tests
  - Test participant listing with proper access control
  - Test payment status updates and participant grouping
  - Test error scenarios and edge cases for organizer operations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_