import { ValidationError } from '../../../shared/errors';

export interface OrganizerItem {
  organizerId: string;
  clerkId: string;
  name: string;
  contact: string;
  website?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizerData {
  name: string;
  contact: string;
  website?: string;
  description?: string;
}

export interface UpdateOrganizerData {
  name?: string;
  contact?: string;
  website?: string;
  description?: string;
}

// Validation schemas for organizer operations
export interface OrganizerValidationSchema {
  name: {
    required: true;
    type: 'string';
    minLength: 1;
    maxLength: 255;
  };
  contact: {
    required: true;
    type: 'string';
    minLength: 1;
    maxLength: 255;
  };
  website: {
    required: false;
    type: 'string';
    maxLength: 500;
    pattern?: RegExp;
  };
  description: {
    required: false;
    type: 'string';
    maxLength: 1000;
  };
}

// Validation functions
export const validateCreateOrganizerData = (data: CreateOrganizerData): void => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new ValidationError('Name is required and must be a non-empty string');
  }

  if (data.name.length > 255) {
    throw new ValidationError('Name must be 255 characters or less');
  }

  if (!data.contact || typeof data.contact !== 'string' || data.contact.trim().length === 0) {
    throw new ValidationError('Contact is required and must be a non-empty string');
  }

  if (data.contact.length > 255) {
    throw new ValidationError('Contact must be 255 characters or less');
  }

  if (data.website !== undefined) {
    if (typeof data.website !== 'string') {
      throw new ValidationError('Website must be a string');
    }

    if (data.website.length > 500) {
      throw new ValidationError('Website must be 500 characters or less');
    }

    // Basic URL validation
    if (data.website.trim().length > 0) {
      const urlPattern = /^https?:\/\/.+/i;
      if (!urlPattern.test(data.website)) {
        throw new ValidationError('Website must be a valid URL starting with http:// or https://');
      }
    }
  }

  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      throw new ValidationError('Description must be a string');
    }

    if (data.description.length > 1000) {
      throw new ValidationError('Description must be 1000 characters or less');
    }
  }
};

export const validateUpdateOrganizerData = (data: UpdateOrganizerData): void => {
  // At least one field must be provided for update
  const hasValidField = Object.keys(data).some(key =>
    data[key as keyof UpdateOrganizerData] !== undefined
  );

  if (!hasValidField) {
    throw new ValidationError('At least one field must be provided for update');
  }

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new ValidationError('Name must be a non-empty string');
    }

    if (data.name.length > 255) {
      throw new ValidationError('Name must be 255 characters or less');
    }
  }

  if (data.contact !== undefined) {
    if (typeof data.contact !== 'string' || data.contact.trim().length === 0) {
      throw new ValidationError('Contact must be a non-empty string');
    }

    if (data.contact.length > 255) {
      throw new ValidationError('Contact must be 255 characters or less');
    }
  }

  if (data.website !== undefined) {
    if (typeof data.website !== 'string') {
      throw new ValidationError('Website must be a string');
    }

    if (data.website.length > 500) {
      throw new ValidationError('Website must be 500 characters or less');
    }

    // Basic URL validation for non-empty strings (allow empty string for clearing)
    if (data.website.trim().length > 0) {
      const urlPattern = /^https?:\/\/.+/i;
      if (!urlPattern.test(data.website)) {
        throw new ValidationError('Website must be a valid URL starting with http:// or https://');
      }
    }
  }

  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      throw new ValidationError('Description must be a string');
    }

    if (data.description.length > 1000) {
      throw new ValidationError('Description must be 1000 characters or less');
    }
    // Allow empty string for clearing the description
  }
};
