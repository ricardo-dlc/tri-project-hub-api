/**
 * User model with Drizzle ORM operations
 * Implements CRUD operations, password hashing, and email validation
 * Requirements: 1.1, 1.2, 6.1, 6.6
 */

import { eq } from 'drizzle-orm';
import { hash, compare } from 'bcryptjs';
import { ulid } from 'ulid';
import { db } from '../../../shared/auth/database';
import { users, type User, type NewUser, type SafeUser, type UserRole } from '../../../shared/auth/schema';

/**
 * User creation data interface
 */
export interface CreateUserData {
    email: string;
    password: string;
    name?: string;
    role?: UserRole;
}

/**
 * User update data interface
 */
export interface UpdateUserData {
    name?: string;
    image?: string;
    role?: UserRole;
    emailVerified?: boolean;
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * User repository class with CRUD operations and validation
 */
export class UserRepository {
    private static readonly BCRYPT_ROUNDS = 12;
    private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    private static readonly MIN_PASSWORD_LENGTH = 8;
    private static readonly MAX_PASSWORD_LENGTH = 128;

    /**
     * Create a new user with password hashing and validation
     * Requirements: 1.1, 1.2, 6.1
     */
    async createUser(userData: CreateUserData): Promise<SafeUser> {
        // Validate email format
        this.validateEmail(userData.email);

        // Validate password strength
        const passwordValidation = this.validatePassword(userData.password);
        if (!passwordValidation.isValid) {
            throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
        }

        // Check email uniqueness
        await this.ensureEmailUnique(userData.email);

        // Hash password
        const passwordHash = await this.hashPassword(userData.password);

        // Prepare user data
        const newUser: NewUser = {
            id: ulid(),
            email: userData.email.toLowerCase().trim(),
            name: userData.name?.trim(),
            role: userData.role || 'user',
            passwordHash,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Insert user into database
        const [createdUser] = await db
            .insert(users)
            .values(newUser)
            .returning();

        if (!createdUser) {
            throw new Error('Failed to create user');
        }

        // Return safe user data (without password hash)
        return this.toSafeUser(createdUser);
    }

    /**
     * Get user by ID
     * Requirements: 6.6
     */
    async getUserById(id: string): Promise<SafeUser | null> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);

        return user ? this.toSafeUser(user) : null;
    }

    /**
     * Get user by email
     * Requirements: 1.1, 1.2
     */
    async getUserByEmail(email: string): Promise<SafeUser | null> {
        const normalizedEmail = email.toLowerCase().trim();

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        return user ? this.toSafeUser(user) : null;
    }

    /**
     * Get user with password hash for authentication
     * Internal method - never expose password hash to external callers
     */
    async getUserWithPasswordByEmail(email: string): Promise<User | null> {
        const normalizedEmail = email.toLowerCase().trim();

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        return user || null;
    }

    /**
     * Update user data
     * Requirements: 6.6
     */
    async updateUser(id: string, updateData: UpdateUserData): Promise<SafeUser> {
        // Sanitize update data
        const sanitizedData = this.sanitizeUpdateData(updateData);

        // Add updated timestamp
        const updatePayload = {
            ...sanitizedData,
            updatedAt: new Date(),
        };

        const [updatedUser] = await db
            .update(users)
            .set(updatePayload)
            .where(eq(users.id, id))
            .returning();

        if (!updatedUser) {
            throw new Error('User not found or update failed');
        }

        return this.toSafeUser(updatedUser);
    }

    /**
     * Update user password
     * Requirements: 6.1
     */
    async updatePassword(id: string, newPassword: string): Promise<void> {
        // Validate new password
        const passwordValidation = this.validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
        }

        // Hash new password
        const passwordHash = await this.hashPassword(newPassword);

        const result = await db
            .update(users)
            .set({
                passwordHash,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id));

        // Check if update was successful by checking the result
        if (!result || result.length === 0) {
            throw new Error('User not found');
        }
    }

    /**
     * Verify user password
     * Requirements: 6.1
     */
    async verifyPassword(email: string, password: string): Promise<{ isValid: boolean; user?: SafeUser }> {
        const user = await this.getUserWithPasswordByEmail(email);

        if (!user) {
            return { isValid: false };
        }

        const isValid = await compare(password, user.passwordHash);

        return {
            isValid,
            user: isValid ? this.toSafeUser(user) : undefined,
        };
    }

    /**
     * Delete user
     * Requirements: 6.6
     */
    async deleteUser(id: string): Promise<void> {
        const result = await db
            .delete(users)
            .where(eq(users.id, id));

        // Check if deletion was successful by checking the result
        if (!result || result.length === 0) {
            throw new Error('User not found');
        }
    }

    /**
     * Check if email exists
     * Requirements: 1.2
     */
    async emailExists(email: string): Promise<boolean> {
        const normalizedEmail = email.toLowerCase().trim();

        const [existingUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        return !!existingUser;
    }

    /**
     * Validate email format
     * Requirements: 1.2
     */
    private validateEmail(email: string): void {
        if (typeof email !== 'string') {
            throw new Error('Email is required');
        }

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            throw new Error('Email cannot be empty');
        }

        if (!UserRepository.EMAIL_REGEX.test(trimmedEmail)) {
            throw new Error('Invalid email format');
        }

        if (trimmedEmail.length > 254) {
            throw new Error('Email is too long');
        }
    }

    /**
     * Validate password strength
     * Requirements: 1.2, 6.1
     */
    private validatePassword(password: string): PasswordValidationResult {
        const errors: string[] = [];

        if (!password || typeof password !== 'string') {
            errors.push('Password is required');
            return { isValid: false, errors };
        }

        if (password.length < UserRepository.MIN_PASSWORD_LENGTH) {
            errors.push(`Password must be at least ${UserRepository.MIN_PASSWORD_LENGTH} characters long`);
        }

        if (password.length > UserRepository.MAX_PASSWORD_LENGTH) {
            errors.push(`Password must be less than ${UserRepository.MAX_PASSWORD_LENGTH} characters long`);
        }

        // Check for at least one uppercase letter
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        // Check for at least one lowercase letter
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        // Check for at least one number
        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        // Check for at least one special character
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Hash password using bcrypt
     * Requirements: 6.1
     */
    private async hashPassword(password: string): Promise<string> {
        return hash(password, UserRepository.BCRYPT_ROUNDS);
    }

    /**
     * Ensure email is unique
     * Requirements: 1.2
     */
    private async ensureEmailUnique(email: string): Promise<void> {
        const exists = await this.emailExists(email);
        if (exists) {
            throw new Error('User with this email already exists');
        }
    }

    /**
     * Convert User to SafeUser (remove password hash)
     * Requirements: 6.6
     */
    private toSafeUser(user: User): SafeUser {
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    }

    /**
     * Sanitize update data to prevent unauthorized field updates
     * Requirements: 6.6
     */
    private sanitizeUpdateData(updateData: UpdateUserData): Partial<NewUser> {
        const sanitized: Partial<NewUser> = {};

        if (updateData.name !== undefined) {
            sanitized.name = updateData.name?.trim() || null;
        }

        if (updateData.image !== undefined) {
            sanitized.image = updateData.image?.trim() || null;
        }

        if (updateData.role !== undefined) {
            // Validate role
            const validRoles: UserRole[] = ['user', 'organizer', 'admin'];
            if (validRoles.includes(updateData.role)) {
                sanitized.role = updateData.role;
            } else {
                throw new Error('Invalid user role');
            }
        }

        if (updateData.emailVerified !== undefined) {
            sanitized.emailVerified = updateData.emailVerified;
        }

        return sanitized;
    }
}

/**
 * Export singleton instance
 */
export const userRepository = new UserRepository();