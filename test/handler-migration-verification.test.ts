import { readFileSync } from 'fs';
import { join } from 'path';

describe('Handler Migration Verification', () => {
  describe('getEvents handler', () => {
    it('should not contain try/catch blocks', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEvents.ts'),
        'utf-8'
      );
      
      // Should not contain try/catch blocks
      expect(handlerContent).not.toMatch(/try\s*{/);
      expect(handlerContent).not.toMatch(/catch\s*\(/);
    });

    it('should not contain JSON.stringify calls', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEvents.ts'),
        'utf-8'
      );
      
      // Should not contain JSON.stringify
      expect(handlerContent).not.toMatch(/JSON\.stringify/);
    });

    it('should use withMiddleware wrapper', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEvents.ts'),
        'utf-8'
      );
      
      // Should import and use withMiddleware
      expect(handlerContent).toMatch(/import.*withMiddleware.*from.*middleware/);
      expect(handlerContent).toMatch(/withMiddleware\(/);
    });

    it('should use arrow function syntax', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEvents.ts'),
        'utf-8'
      );
      
      // Should use arrow function syntax
      expect(handlerContent).toMatch(/const.*=.*async.*=>/);
    });

    it('should return plain object with events property', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEvents.ts'),
        'utf-8'
      );
      
      // Should return plain object with events property
      expect(handlerContent).toMatch(/return\s*{\s*events:/);
    });
  });

  describe('getEventBySlug handler', () => {
    it('should not contain try/catch blocks', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEventBySlug.ts'),
        'utf-8'
      );
      
      // Should not contain try/catch blocks
      expect(handlerContent).not.toMatch(/try\s*{/);
      expect(handlerContent).not.toMatch(/catch\s*\(/);
    });

    it('should not contain JSON.stringify calls', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEventBySlug.ts'),
        'utf-8'
      );
      
      // Should not contain JSON.stringify
      expect(handlerContent).not.toMatch(/JSON\.stringify/);
    });

    it('should use withMiddleware wrapper', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEventBySlug.ts'),
        'utf-8'
      );
      
      // Should import and use withMiddleware
      expect(handlerContent).toMatch(/import.*withMiddleware.*from.*middleware/);
      expect(handlerContent).toMatch(/withMiddleware\(/);
    });

    it('should use arrow function syntax', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEventBySlug.ts'),
        'utf-8'
      );
      
      // Should use arrow function syntax
      expect(handlerContent).toMatch(/const.*=.*async.*=>/);
    });

    it('should use destructuring for path parameters', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEventBySlug.ts'),
        'utf-8'
      );
      
      // Should use destructuring for path parameters
      expect(handlerContent).toMatch(/const\s*{\s*slug\s*}\s*=/);
    });

    it('should use optional chaining for parameter validation', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEventBySlug.ts'),
        'utf-8'
      );
      
      // Should use optional chaining
      expect(handlerContent).toMatch(/\?\?/);
    });

    it('should use semantic error classes', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEventBySlug.ts'),
        'utf-8'
      );
      
      // Should import and use semantic error classes
      expect(handlerContent).toMatch(/import.*BadRequestError.*NotFoundError.*from.*middleware/);
      expect(handlerContent).toMatch(/throw new BadRequestError/);
      expect(handlerContent).toMatch(/throw new NotFoundError/);
    });

    it('should return plain object with event property', () => {
      const handlerContent = readFileSync(
        join(__dirname, '../lambdas/events/getEventBySlug.ts'),
        'utf-8'
      );
      
      // Should return plain object with event property
      expect(handlerContent).toMatch(/return\s*{\s*event:/);
    });
  });
});