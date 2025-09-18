/**
 * Unit tests for UserService
 * Tests user management operations with proper validation and authorization
 * Requirements: 4.1, 6.6
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UserService, UserNotFoundError, UnauthorizedError, ValidationError } from '../user.service';
import { userRepository } from '../../models/user.model';
import { sessionRepository } from '../../models/session.model';

// Mock dependencies
jest.mock('../../models/user.model');
jest.mock('../../models/session.model');
jest.mock('../../../../shared/auth/config', () => ({
  config: {
    auth: {
      passwordMinLength: 8,
      passwordMaxLength: 128,
    }
  }
}));
jest.mock('../../../../shared/auth/database', () => ({
  db: {}
}));

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockSessionRepository = sessionRepository as jest.Mocked<typeof sessionRepository>;

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getUserProfile', () => {
    const validUserId = 'user_01234567890123456789012345';

    it('should return user profile for valid user ID', async () => {
      // Arrange
      const mockUser = {
        id: validUserId,
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.getUserById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserProfile(validUserId);

      // Assert
      expect(result).toEqual({
        id: validUserId,
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'user',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith(validUserId);
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      // Arrange
      mockUserRepository.getUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getUserProfile(validUserId)).rejects.toThrow(UserNotFoundError);
    });

    it('should throw ValidationError for invalid user ID format', async () => {
      // Arrange
      const invalidUserId = 'invalid_id';

      // Act & Assert
      await expect(userService.getUserProfile(invalidUserId)).rejects.toThrow();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      mockUserRepository.getUserById.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(userService.getUserProfile(validUserId)).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('getUserByEmail', () => {
    it('should return user for valid email', async () => {
      // Arrange
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      mockUserRepository.getUserByEmail.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserByEmail('test@example.com');

      // Assert
      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent email', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockResolvedValue(null);

      // Act
      const result = await userService.getUserByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null on repository error', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await userService.getUserByEmail('error@example.com');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    const validUserId = 'user_01234567890123456789012345';
    const validRequestingUserId = 'user_01234567890123456789012345';
    const adminUserId = 'admin_01234567890123456789012345';

    const updateData = {
      name: 'Updated Name',
      image: 'https://example.com/image.jpg',
    };

    it('should allow user to update their own profile', async () => {
      // Arrange
      const existingUser = {
        id: validUserId,
        email: 'test@example.com',
        name: 'Old Name',
        role: 'user',
      };

      const updatedUser = {
        ...existingUser,
        name: 'Updated Name',
        image: 'https://example.com/image.jpg',
      };

      mockUserRepository.getUserById.mockResolvedValue(existingUser);
      mockUserRepository.updateUser.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUserProfile(
        validUserId,
        updateData,
        validRequestingUserId,
        'user'
      );

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(validUserId, updateData);
    });

    it('should allow admin to update any user profile', async () => {
      // Arrange
      const existingUser = {
        id: validUserId,
        email: 'test@example.com',
        name: 'Old Name',
        role: 'user',
      };

      const updatedUser = {
        ...existingUser,
        name: 'Updated Name',
      };

      mockUserRepository.getUserById.mockResolvedValue(existingUser);
      mockUserRepository.updateUser.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUserProfile(
        validUserId,
        updateData,
        adminUserId,
        'admin'
      );

      // Assert
      expect(result).toEqual(updatedUser);
    });

    it('should throw UnauthorizedError when user tries to update another user', async () => {
      // Arrange
      const otherUserId = 'other_01234567890123456789012345';

      // Act & Assert
      await expect(
        userService.updateUserProfile(otherUserId, updateData, validUserId, 'user')
      ).rejects.toThrow(UnauthorizedError);

      expect(mockUserRepository.getUserById).not.toHaveBeenCalled();
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      // Arrange
      mockUserRepository.getUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.updateUserProfile(validUserId, updateData, validUserId, 'user')
      ).rejects.toThrow(UserNotFoundError);
    });

    it('should handle invalid update data', async () => {
      // Arrange
      const invalidUpdateData = {
        name: '', // Empty name should be invalid
      };

      // Act & Assert
      await expect(
        userService.updateUserProfile(validUserId, invalidUpdateData, validUserId, 'user')
      ).rejects.toThrow();
    });
  });

  describe('updateUserRole', () => {
    const validUserId = 'user_01234567890123456789012345';
    const adminUserId = 'admin_01234567890123456789012345';

    it('should allow admin to update user role', async () => {
      // Arrange
      const existingUser = {
        id: validUserId,
        email: 'test@example.com',
        role: 'user',
      };

      const updatedUser = {
        ...existingUser,
        role: 'organizer',
      };

      mockUserRepository.getUserById.mockResolvedValue(existingUser);
      mockUserRepository.updateUser.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUserRole(
        validUserId,
        'organizer',
        adminUserId,
        'admin'
      );

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(validUserId, { role: 'organizer' });
    });

    it('should throw UnauthorizedError for non-admin user', async () => {
      // Act & Assert
      await expect(
        userService.updateUserRole(validUserId, 'organizer', validUserId, 'user')
      ).rejects.toThrow(UnauthorizedError);

      expect(mockUserRepository.getUserById).not.toHaveBeenCalled();
    });

    it('should prevent admin self-demotion', async () => {
      // Act & Assert
      await expect(
        userService.updateUserRole(adminUserId, 'user', adminUserId, 'admin')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      // Arrange
      mockUserRepository.getUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.updateUserRole(validUserId, 'organizer', adminUserId, 'admin')
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('deleteUser', () => {
    const validUserId = 'user_01234567890123456789012345';
    const adminUserId = 'admin_01234567890123456789012345';

    it('should allow user to delete their own account', async () => {
      // Arrange
      const existingUser = {
        id: validUserId,
        email: 'test@example.com',
        role: 'user',
      };

      mockUserRepository.getUserById.mockResolvedValue(existingUser);
      mockSessionRepository.deleteUserSessions.mockResolvedValue(undefined);
      mockUserRepository.deleteUser.mockResolvedValue(undefined);

      // Mock getAdminCount to return > 1 (not applicable for regular users)
      jest.spyOn(userService as any, 'getAdminCount').mockResolvedValue(2);

      // Act
      await userService.deleteUser(validUserId, validUserId, 'user');

      // Assert
      expect(mockSessionRepository.deleteUserSessions).toHaveBeenCalledWith(validUserId);
      expect(mockUserRepository.deleteUser).toHaveBeenCalledWith(validUserId);
    });

    it('should allow admin to delete any user account', async () => {
      // Arrange
      const existingUser = {
        id: validUserId,
        email: 'test@example.com',
        role: 'user',
      };

      mockUserRepository.getUserById.mockResolvedValue(existingUser);
      mockSessionRepository.deleteUserSessions.mockResolvedValue(undefined);
      mockUserRepository.deleteUser.mockResolvedValue(undefined);

      // Act
      await userService.deleteUser(validUserId, adminUserId, 'admin');

      // Assert
      expect(mockSessionRepository.deleteUserSessions).toHaveBeenCalledWith(validUserId);
      expect(mockUserRepository.deleteUser).toHaveBeenCalledWith(validUserId);
    });

    it('should throw UnauthorizedError when user tries to delete another user', async () => {
      // Arrange
      const otherUserId = 'other_01234567890123456789012345';

      // Act & Assert
      await expect(
        userService.deleteUser(otherUserId, validUserId, 'user')
      ).rejects.toThrow(UnauthorizedError);

      expect(mockUserRepository.getUserById).not.toHaveBeenCalled();
    });

    it('should prevent deletion of last admin', async () => {
      // Arrange
      const existingUser = {
        id: adminUserId,
        email: 'admin@example.com',
        role: 'admin',
      };

      mockUserRepository.getUserById.mockResolvedValue(existingUser);
      
      // Mock getAdminCount to return 1 (last admin)
      jest.spyOn(userService as any, 'getAdminCount').mockResolvedValue(1);

      // Act & Assert
      await expect(
        userService.deleteUser(adminUserId, adminUserId, 'admin')
      ).rejects.toThrow(UnauthorizedError);

      expect(mockUserRepository.deleteUser).not.toHaveBeenCalled();
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      // Arrange
      mockUserRepository.getUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.deleteUser(validUserId, validUserId, 'user')
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('listUsers', () => {
    it('should allow admin to list users', async () => {
      // Act
      const result = await userService.listUsers('admin', 1, 20);

      // Assert
      expect(result).toEqual({
        users: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });
    });

    it('should throw UnauthorizedError for non-admin user', async () => {
      // Act & Assert
      await expect(userService.listUsers('user', 1, 20)).rejects.toThrow(UnauthorizedError);
    });

    it('should handle invalid pagination parameters', async () => {
      // Act
      const result = await userService.listUsers('admin', -1, 200);

      // Assert
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(100); // Capped at 100
    });
  });

  describe('userHasRole', () => {
    const validUserId = 'user_01234567890123456789012345';

    it('should return true when user has the specified role', async () => {
      // Arrange
      const mockUser = {
        id: validUserId,
        role: 'organizer',
      };

      mockUserRepository.getUserById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.userHasRole(validUserId, 'organizer');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when user does not have the specified role', async () => {
      // Arrange
      const mockUser = {
        id: validUserId,
        role: 'user',
      };

      mockUserRepository.getUserById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.userHasRole(validUserId, 'admin');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      // Arrange
      mockUserRepository.getUserById.mockResolvedValue(null);

      // Act
      const result = await userService.userHasRole(validUserId, 'user');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      // Arrange
      mockUserRepository.getUserById.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await userService.userHasRole(validUserId, 'user');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('userHasAnyRole', () => {
    const validUserId = 'user_01234567890123456789012345';

    it('should return true when user has one of the specified roles', async () => {
      // Arrange
      const mockUser = {
        id: validUserId,
        role: 'organizer',
      };

      mockUserRepository.getUserById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.userHasAnyRole(validUserId, ['user', 'organizer']);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when user does not have any of the specified roles', async () => {
      // Arrange
      const mockUser = {
        id: validUserId,
        role: 'user',
      };

      mockUserRepository.getUserById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.userHasAnyRole(validUserId, ['organizer', 'admin']);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      // Arrange
      mockUserRepository.getUserById.mockResolvedValue(null);

      // Act
      const result = await userService.userHasAnyRole(validUserId, ['user', 'admin']);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getUserStats', () => {
    it('should allow admin to view user statistics', async () => {
      // Act
      const result = await userService.getUserStats('admin');

      // Assert
      expect(result).toEqual({
        totalUsers: 0,
        usersByRole: {
          user: 0,
          organizer: 0,
          admin: 0,
        },
        recentRegistrations: 0,
      });
    });

    it('should throw UnauthorizedError for non-admin user', async () => {
      // Act & Assert
      await expect(userService.getUserStats('user')).rejects.toThrow(UnauthorizedError);
    });
  });
});