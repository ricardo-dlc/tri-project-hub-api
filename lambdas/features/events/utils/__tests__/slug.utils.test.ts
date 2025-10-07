import { EventEntity } from '../../models/event.model';
import { generateUniqueSlug, isValidSlug, sanitizeSlug, slugExists } from '../slug.utils';

// Mock the EventEntity
jest.mock('../../models/event.model', () => ({
  EventEntity: {
    query: {
      SlugIndex: jest.fn(),
    },
  },
}));

// Mock the logger
jest.mock('../../../../shared/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Slug Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizeSlug', () => {
    it('should convert title to lowercase slug', () => {
      const result = sanitizeSlug('My Event Title');
      expect(result).toBe('my-event-title');
    });

    it('should remove special characters', () => {
      const result = sanitizeSlug('Event! @#$% Title');
      expect(result).toBe('event-title');
    });

    it('should handle multiple spaces', () => {
      const result = sanitizeSlug('Event    With    Spaces');
      expect(result).toBe('event-with-spaces');
    });

    it('should handle multiple hyphens', () => {
      const result = sanitizeSlug('Event---With---Hyphens');
      expect(result).toBe('event-with-hyphens');
    });

    it('should remove leading and trailing hyphens', () => {
      const result = sanitizeSlug('---Event Title---');
      expect(result).toBe('event-title');
    });

    it('should handle empty string', () => {
      const result = sanitizeSlug('');
      expect(result).toBe('');
    });

    it('should handle string with only special characters', () => {
      const result = sanitizeSlug('!@#$%^&*()');
      expect(result).toBe('');
    });

    it('should preserve numbers', () => {
      const result = sanitizeSlug('Event 2024 Marathon');
      expect(result).toBe('event-2024-marathon');
    });

    it('should handle mixed case with numbers', () => {
      const result = sanitizeSlug('5K Run Event 2024');
      expect(result).toBe('5k-run-event-2024');
    });
  });

  describe('isValidSlug', () => {
    it('should validate correct slug format', () => {
      expect(isValidSlug('valid-slug')).toBe(true);
      expect(isValidSlug('valid-slug-123')).toBe(true);
      expect(isValidSlug('validslug')).toBe(true);
      expect(isValidSlug('123-valid')).toBe(true);
    });

    it('should reject invalid slug formats', () => {
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug('-invalid')).toBe(false);
      expect(isValidSlug('invalid-')).toBe(false);
      expect(isValidSlug('invalid--slug')).toBe(false);
      expect(isValidSlug('Invalid-Slug')).toBe(false);
      expect(isValidSlug('invalid_slug')).toBe(false);
      expect(isValidSlug('invalid.slug')).toBe(false);
    });

    it('should reject slugs that are too long', () => {
      const longSlug = 'a'.repeat(101);
      expect(isValidSlug(longSlug)).toBe(false);
    });

    it('should accept slugs at the length limit', () => {
      const maxLengthSlug = 'a'.repeat(100);
      expect(isValidSlug(maxLengthSlug)).toBe(true);
    });
  });

  describe('slugExists', () => {
    const mockQuery = {
      go: jest.fn(),
    };

    beforeEach(() => {
      (EventEntity.query.SlugIndex as jest.Mock).mockReturnValue(mockQuery);
    });

    it('should return true when slug exists', async () => {
      mockQuery.go.mockResolvedValue({ data: [{ slug: 'existing-slug' }] });

      const result = await slugExists('existing-slug');

      expect(result).toBe(true);
      expect(EventEntity.query.SlugIndex).toHaveBeenCalledWith({ slug: 'existing-slug' });
    });

    it('should return false when slug does not exist', async () => {
      mockQuery.go.mockResolvedValue({ data: [] });

      const result = await slugExists('non-existing-slug');

      expect(result).toBe(false);
      expect(EventEntity.query.SlugIndex).toHaveBeenCalledWith({ slug: 'non-existing-slug' });
    });

    it('should throw error when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.go.mockRejectedValue(dbError);

      await expect(slugExists('test-slug')).rejects.toThrow('Database connection failed');
    });
  });

  describe('generateUniqueSlug', () => {
    const mockQuery = {
      go: jest.fn(),
    };

    beforeEach(() => {
      (EventEntity.query.SlugIndex as jest.Mock).mockReturnValue(mockQuery);
    });

    it('should generate unique slug when no collision', async () => {
      mockQuery.go.mockResolvedValue({ data: [] });

      const result = await generateUniqueSlug('My Event Title');

      expect(result).toBe('my-event-title');
      expect(EventEntity.query.SlugIndex).toHaveBeenCalledWith({ slug: 'my-event-title' });
    });

    it('should handle collision by appending counter', async () => {
      mockQuery.go
        .mockResolvedValueOnce({ data: [{ slug: 'my-event-title' }] }) // First call - exists
        .mockResolvedValueOnce({ data: [{ slug: 'my-event-title-1' }] }) // Second call - exists
        .mockResolvedValueOnce({ data: [] }); // Third call - doesn't exist

      const result = await generateUniqueSlug('My Event Title');

      expect(result).toBe('my-event-title-2');
      expect(EventEntity.query.SlugIndex).toHaveBeenCalledTimes(3);
    });

    it('should throw error for empty title', async () => {
      await expect(generateUniqueSlug('')).rejects.toThrow('Title is required and must be a string');
    });

    it('should throw error for non-string title', async () => {
      await expect(generateUniqueSlug(null as any)).rejects.toThrow('Title is required and must be a string');
      await expect(generateUniqueSlug(undefined as any)).rejects.toThrow('Title is required and must be a string');
      await expect(generateUniqueSlug(123 as any)).rejects.toThrow('Title is required and must be a string');
    });

    it('should throw error for title with no alphanumeric characters', async () => {
      await expect(generateUniqueSlug('!@#$%^&*()')).rejects.toThrow('Title must contain at least one alphanumeric character');
    });

    it('should handle database errors during slug generation', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.go.mockRejectedValue(dbError);

      await expect(generateUniqueSlug('Test Event')).rejects.toThrow('Database connection failed');
    });

    it('should prevent infinite loops with counter limit', async () => {
      // Mock to always return existing slug
      mockQuery.go.mockResolvedValue({ data: [{ slug: 'test' }] });

      await expect(generateUniqueSlug('Test')).rejects.toThrow('Unable to generate unique slug after 1000 attempts');
    });

    it('should handle complex titles with mixed content', async () => {
      mockQuery.go.mockResolvedValue({ data: [] });

      const result = await generateUniqueSlug('5K Marathon Run 2024! @#$%');

      expect(result).toBe('5k-marathon-run-2024');
    });

    it('should handle titles that result in very short slugs', async () => {
      mockQuery.go.mockResolvedValue({ data: [] });

      const result = await generateUniqueSlug('A');

      expect(result).toBe('a');
    });
  });
});
