// Export unified registration handler that handles both individual and team registrations
export { handler as createRegistration } from './createRegistration';

// Export individual handlers for testing purposes (if needed)
export { handler as createIndividualRegistration } from './createIndividualRegistration';
export { handler as createTeamRegistration } from './createTeamRegistration';

// Export participant query handler
export { handler as getParticipantsByEvent } from './getParticipantsByEvent';
