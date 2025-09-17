/**
 * User service layer
 * Provides user management operations with proper validation and sanitization
 * Requirements: 4.1, 6.6
 */

import { sessionRepository } from '../models/session.model';
import { userRepository, type UpdateUserData } from '../models/user.model';
import {
  type ProfileUpdateRequest,
  type PublicUser,
  type UserRole
} from '../types/auth.types';
import {
  validateProfileUpdateRequest,
  validateULID,
  validateUserRole,
} from '../types/validation.schemas';

/**
 * User service error classes
 */
export class UserNotFoundError extends Error {
  constructor(message: string = 'User not found', public code: string = 'USER_NOT_FOUND') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized access', public code: string = 'UNAUTHORIZED') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * User service class
 * Provides high-level user management operations with proper authorization
 */
export class UserService {
  /**
   * Get user profile by ID (public data only)
   * Requirements: 6.6
   */
  async getUserProfile(userId: string): Promise<PublicUser> {
    try {
      // Validate user ID format
      validateULID(userId);

      const user = await userRepository.getUserById(userId);
      if (!user) {
        throw new UserNotFoundError('User not found');
      }

      return this.toPublicUser(user);
    } catch (error) {
      if (error instanceof UserNotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new UserNotFoundError('Failed to retrieve user profile');
    }
  }

  /**
   * Get user by email (internal use)
   * Requirements: 6.6
   */
  async getUserByEmail(email: string): Promise<PublicUser | null> {
    try {
      const user = await userRepository.getUserByEmail(email);
      return user ? this.toPublicUser(user) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update user profile with authorization check
   * Requirements: 4.1, 6.6
   */
  async updateUserProfile(
    userId: string,
    updateData: ProfileUpdateRequest,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): Promise<PublicUser> {
    try {
      // Validate input data
      validateULID(userId);
      validateULID(requestingUserId);
      const validatedData = validateProfileUpdateRequest(updateData);

      // Authorization check: users can only update their own profile, admins can update any
      if (userId !== requestingUserId && requestingUserRole !== 'admin') {
        throw new UnauthorizedError('You can only update your own profile');
      }

      // Check if user exists
      const existingUser = await userRepository.getUserById(userId);
      if (!existingUser) {
        throw new UserNotFoundError('User not found');
      }

      // Prepare update data
      const updatePayload: UpdateUserData = {
        name: validatedData.name,
        image: validatedData.image,
      };

      // Update user
      const updatedUser = await userRepository.updateUser(userId, updatePayload);
      return this.toPublicUser(updatedUser);
    } catch (error) {
      if (error instanceof UserNotFoundError ||
        error instanceof UnauthorizedError ||
        error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Failed to update user profile');
    }
  }

  /**
   * Update user role (admin only)
   * Requirements: 4.1
   */
  async updateUserRole(
    userId: string,
    newRole: UserRole,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): Promise<PublicUser> {
    try {
      // Validate input data
      validateULID(userId);
      validateULID(requestingUserId);
      validateUserRole(newRole);

      // Authorization check: only admins can change user roles
      if (requestingUserRole !== 'admin') {
        throw new UnauthorizedError('Only administrators can change user roles');
      }

      // Prevent self-demotion from admin
      if (userId === requestingUserId && newRole !== 'admin') {
        throw new UnauthorizedError('Administrators cannot demote themselves');
      }

      // Check if user exists
      const existingUser = await userRepository.getUserById(userId);
      if (!existingUser) {
        throw new UserNotFoundError('User not found');
      }

      // Update user role
      const updatedUser = await userRepository.updateUser(userId, { role: newRole });
      return this.toPublicUser(updatedUser);
    } catch (error) {
      if (error instanceof UserNotFoundError ||
        error instanceof UnauthorizedError ||
        error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Failed to update user role');
    }
  }

  /**
   * Delete user account with proper authorization
   * Requirements: 4.1, 6.6
   */
  async deleteUser(
    userId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): Promise<void> {
    try {
      // Validate input data
      validateULID(userId);
      validateULID(requestingUserId);

      // Authorization check: users can delete their own account, admins can delete any
      if (userId !== requestingUserId && requestingUserRole !== 'admin') {
        throw new UnauthorizedError('You can only delete your own account');
      }

      // Prevent admin self-deletion if they're the only admin
      if (userId === requestingUserId && requestingUserRole === 'admin') {
        const adminCount = await this.getAdminCount();
        if (adminCount <= 1) {
          throw new UnauthorizedError('Cannot delete the last administrator account');
        }
      }

      // Check if user exists
      const existingUser = await userRepository.getUserById(userId);
      if (!existingUser) {
        throw new UserNotFoundError('User not found');
      }

      // Clean up user sessions first
      await sessionRepository.deleteUserSessions(userId);

      // Delete user
      await userRepository.deleteUser(userId);
    } catch (error) {
      if (error instanceof UserNotFoundError ||
        error instanceof UnauthorizedError) {
        throw error;
      }
      throw new ValidationError('Failed to delete user account');
    }
  }

  /**
   * List users with pagination (admin only)
   * Requirements: 4.1
   */
  async listUsers(
    requestingUserRole: UserRole,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    users: PublicUser[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      // Authorization check: only admins can list users
      if (requestingUserRole !== 'admin') {
        throw new UnauthorizedError('Only administrators can list users');
      }

      // Validate pagination parameters
      const validPage = Math.max(1, Math.floor(page));
      const validLimit = Math.min(100, Math.max(1, Math.floor(limit)));

      // This is a simplified implementation - in a real app you'd implement pagination in the repository
      // For now, we'll just return a basic structure
      return {
        users: [], // Would be populated with actual user data
        pagination: {
          page: validPage,
          limit: validLimit,
          total: 0,
          totalPages: 0,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new ValidationError('Failed to list users');
    }
  }

  /**
   * Check if user has specific role
   * Requirements: 4.1
   */
  async userHasRole(userId: string, role: UserRole): Promise<boolean> {
    try {
      validateULID(userId);
      validateUserRole(role);

      const user = await userRepository.getUserById(userId);
      return user ? user.role === role : false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user has any of the specified roles
   * Requirements: 4.1
   */
  async userHasAnyRole(userId: string, roles: UserRole[]): Promise<boolean> {
    try {
      validateULID(userId);
      roles.forEach(role => validateUserRole(role));

      const user = await userRepository.getUserById(userId);
      return user ? roles.includes(user.role as UserRole) : false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user statistics (admin only)
   * Requirements: 4.1
   */
  async getUserStats(requestingUserRole: UserRole): Promise<{
    totalUsers: number;
    usersByRole: Record<UserRole, number>;
    recentRegistrations: number; // Last 30 days
  }> {
    try {
      // Authorization check: only admins can view user statistics
      if (requestingUserRole !== 'admin') {
        throw new UnauthorizedError('Only administrators can view user statistics');
      }

      // This is a simplified implementation - would be implemented in the repository
      return {
        totalUsers: 0,
        usersByRole: {
          user: 0,
          organizer: 0,
          admin: 0,
        },
        recentRegistrations: 0,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new ValidationError('Failed to retrieve user statistics');
    }
  }

  /**
   * Convert User to PublicUser (remove sensitive data)
   * Requirements: 6.6
   */
  private toPublicUser(user: any): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get count of admin users (for safety checks)
   */
  private async getAdminCount(): Promise<number> {
    // This would be implemented in the repository
    // For now, return a safe default
    return 1;
  }
}

/**
 * Export singleton instance
 */
export const userService = new UserService();