# Requirements Document

## Introduction

This feature implements a comprehensive event registration system that allows participants to register for triathlon events. The system handles both individual and team registrations, stores participant information, prevents duplicate registrations based on email addresses, and tracks payment status for organizers to manage event participation effectively.

## Requirements

### Requirement 1

**User Story:** As a participant, I want to register for individual events, so that I can participate in triathlon competitions.

#### Acceptance Criteria

1. WHEN a participant submits individual registration data THEN the system SHALL store all participant information including personal details, emergency contacts, and preferences
2. WHEN a participant registers for an event THEN the system SHALL validate that the email address is not already registered for that specific event
3. WHEN registration is successful THEN the system SHALL create a registration record with a unique ULID-based reservation ID and payment status set to unpaid by default
4. IF the event has reached maximum participants THEN the system SHALL reject the registration and return an appropriate error message
5. WHEN individual registration is successful THEN the system SHALL return the ULID-based reservation ID for payment tracking

### Requirement 2

**User Story:** As a team captain, I want to register my team for team events, so that we can participate as a group in relay or team competitions.

#### Acceptance Criteria

1. WHEN a team captain submits team registration data THEN the system SHALL store team-level information and all individual participant details
2. WHEN team registration is submitted THEN the system SHALL validate that no participant email appears more than once within the team registration
3. WHEN team registration is submitted THEN the system SHALL validate that no participant email is already registered for that specific event from previous registrations
4. IF the team size exceeds the event's required participants limit THEN the system SHALL reject the registration
5. WHEN team registration is successful THEN the system SHALL create a single registration record with a unique ULID-based reservation ID that covers all team members
6. WHEN team registration is successful THEN the system SHALL store all participant details linked to the same ULID-based reservation ID

### Requirement 3

**User Story:** As an event organizer, I want to view all participants registered for my events, so that I can manage event logistics and track registrations.

#### Acceptance Criteria

1. WHEN an organizer requests participant list for an event THEN the system SHALL return all registered participants with their complete information
2. WHEN displaying participant information THEN the system SHALL include payment status for each participant
3. WHEN organizer views registrations THEN the system SHALL distinguish between individual and team registrations
4. WHEN organizer accesses participant data THEN the system SHALL only show participants for events they created

### Requirement 4

**User Story:** As an event organizer, I want to track payment status for registered participants, so that I can identify who has completed their registration fee payment.

#### Acceptance Criteria

1. WHEN a registration is created THEN the system SHALL generate a unique ULID-based reservation ID and set payment status to false by default
2. WHEN payment status is updated THEN the system SHALL allow changing from unpaid to paid status for the entire registration (covering all participants in team events)
3. WHEN organizer views registrations THEN the system SHALL clearly display payment status grouped by ULID-based reservation ID
4. WHEN generating participant reports THEN the system SHALL include ULID-based reservation ID and payment status information
5. WHEN team registration payment is completed THEN the system SHALL mark all participants under that ULID-based reservation ID as paid

### Requirement 5

**User Story:** As a system administrator, I want to ensure data integrity for registrations, so that the system maintains accurate participant records.

#### Acceptance Criteria

1. WHEN storing registration data THEN the system SHALL validate required fields (firstName, lastName, email)
2. WHEN processing registration THEN the system SHALL validate email format
3. WHEN registration data is stored THEN the system SHALL include timestamps for creation and updates
4. WHEN duplicate email registration is attempted for the same event THEN the system SHALL prevent the registration and return a clear error message
5. WHEN registration is successful THEN the system SHALL update the event's current participant count

### Requirement 6

**User Story:** As a system, I want to generate unique reservation IDs for each registration, so that payment and participant tracking is simplified across individual and team registrations.

#### Acceptance Criteria

1. WHEN any registration is created THEN the system SHALL generate a unique ULID-based reservation ID
2. WHEN individual registration is created THEN the system SHALL link one participant to one ULID-based reservation ID
3. WHEN team registration is created THEN the system SHALL link all team participants to the same ULID-based reservation ID
4. WHEN payment processing occurs THEN the system SHALL use the ULID-based reservation ID to identify which participants are covered by the payment
5. WHEN organizer queries registrations THEN the system SHALL group participants by ULID-based reservation ID for easier management

### Requirement 7

**User Story:** As a participant, I want my registration to include optional information like dietary restrictions and medical conditions, so that organizers can accommodate my needs.

#### Acceptance Criteria

1. WHEN participant submits registration THEN the system SHALL accept and store optional fields including dietary restrictions, medical conditions, medications, and allergies
2. WHEN optional fields are not provided THEN the system SHALL store them as empty or null values without requiring input
3. WHEN organizer views participant details THEN the system SHALL display all provided optional information for event planning purposes

### Requirement 8

**User Story:** As a system administrator, I want all entities to use ULID identifiers, so that the system has consistent, sortable, and globally unique identifiers across all data types.

#### Acceptance Criteria

1. WHEN any participant record is created THEN the system SHALL generate a unique ULID-based participant ID
2. WHEN any registration record is created THEN the system SHALL generate a unique ULID-based reservation ID
3. WHEN storing entity relationships THEN the system SHALL use ULID identifiers for all foreign key references
4. WHEN generating API responses THEN the system SHALL return ULID identifiers for all entity IDs
5. WHEN querying data THEN the system SHALL accept ULID identifiers as valid input parameters