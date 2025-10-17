import { PaymentStatusService } from '../payment-status.service';
import { RegistrationEntity } from '../../models/registration.model';
import { generateReservationId } from '@/shared/utils/ulid';
import { NotFoundError, ValidationError } from '@/shared/errors';

// Mock the RegistrationEntity
jest.mock('../../models/registration.model', () => ({
  RegistrationEntity: {
    get: jest.fn(),
    update: jest.fn(),
  },
}));

// Mock the logger
jest.mock('@/shared/logger', () => ({
  createFeatureLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('PaymentStatusService', () => {
  let paymentStatusService: PaymentStatusService;
  let mockRegistrationEntity: jest.Mocked<typeof RegistrationEntity>;

  beforeEach(() => {
    paymentStatusService = new PaymentStatusService();
    mockRegistrationEntity = RegistrationEntity as jest.Mocked<typeof RegistrationEntity>;
    jest.clearAllMocks();
  });

  describe('updatePaymentStatus', () => {
    const validReservationId = generateReservationId();
    const mockRegistrationData = {
      reservationId: validReservationId,
      eventId: generateReservationId(),
      registrationType: 'individual' as const,
      paymentStatus: false,
      totalParticipants: 1,
      registrationFee: 100,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      paymentDate: '2024-01-01T00:00:00.000Z'
    };

    it('should successfully update payment status to paid', async () => {
      // Mock getting existing registration
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockRegistrationData
        })
      } as any);

      // Mock update operation
      const updatedData = { ...mockRegistrationData, paymentStatus: true };
      mockRegistrationEntity.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: updatedData
          })
        })
      } as any);

      const result = await paymentStatusService.updatePaymentStatus({
        reservationId: validReservationId,
        paymentStatus: true
      });

      expect(result).toEqual({
        success: true,
        reservationId: validReservationId,
        paymentStatus: true,
        paymentDate: expect.any(String),
        totalParticipants: 1
      });

      expect(mockRegistrationEntity.get).toHaveBeenCalledWith({
        reservationId: validReservationId
      });
      expect(mockRegistrationEntity.update).toHaveBeenCalledWith({
        reservationId: validReservationId
      });
    });

    it('should successfully update payment status to unpaid', async () => {
      // Mock getting existing registration (currently paid)
      const paidRegistration = { ...mockRegistrationData, paymentStatus: true };
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: paidRegistration
        })
      } as any);

      // Mock update operation
      const updatedData = { ...paidRegistration, paymentStatus: false };
      mockRegistrationEntity.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: updatedData
          })
        })
      } as any);

      const result = await paymentStatusService.updatePaymentStatus({
        reservationId: validReservationId,
        paymentStatus: false
      });

      expect(result).toEqual({
        success: true,
        reservationId: validReservationId,
        paymentStatus: false,
        paymentDate: expect.any(String),
        totalParticipants: 1
      });
    });

    it('should use custom payment date when provided', async () => {
      const customPaymentDate = '2024-02-01T12:00:00.000Z';
      
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockRegistrationData
        })
      } as any);

      const updatedData = { ...mockRegistrationData, paymentStatus: true };
      mockRegistrationEntity.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: updatedData
          })
        })
      } as any);

      const result = await paymentStatusService.updatePaymentStatus({
        reservationId: validReservationId,
        paymentStatus: true,
        paymentDate: customPaymentDate
      });

      expect(result.paymentDate).toBe(customPaymentDate);
    });

    it('should throw ValidationError for invalid ULID format', async () => {
      const invalidReservationId = 'invalid-id';

      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: invalidReservationId,
          paymentStatus: true
        })
      ).rejects.toThrow(ValidationError);

      expect(mockRegistrationEntity.get).not.toHaveBeenCalled();
      expect(mockRegistrationEntity.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when registration does not exist', async () => {
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: null
        })
      } as any);

      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: validReservationId,
          paymentStatus: true
        })
      ).rejects.toThrow(NotFoundError);

      expect(mockRegistrationEntity.update).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      } as any);

      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: validReservationId,
          paymentStatus: true
        })
      ).rejects.toThrow('Failed to update payment status: Database connection failed');
    });

    it('should handle update operation failures', async () => {
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockRegistrationData
        })
      } as any);

      mockRegistrationEntity.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockRejectedValue(new Error('Update failed'))
        })
      } as any);

      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: validReservationId,
          paymentStatus: true
        })
      ).rejects.toThrow('Failed to update payment status: Update failed');
    });
  });

  describe('getRegistrationByReservationId', () => {
    const validReservationId = generateReservationId();
    const mockRegistrationData = {
      reservationId: validReservationId,
      eventId: generateReservationId(),
      registrationType: 'individual' as const,
      paymentStatus: false,
      totalParticipants: 1,
      registrationFee: 100,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      paymentDate: '2024-01-01T00:00:00.000Z'
    };

    it('should return registration data for valid reservation ID', async () => {
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockRegistrationData
        })
      } as any);

      const result = await paymentStatusService.getRegistrationByReservationId(validReservationId);

      expect(result).toEqual(mockRegistrationData);
      expect(mockRegistrationEntity.get).toHaveBeenCalledWith({
        reservationId: validReservationId
      });
    });

    it('should return null when registration is not found', async () => {
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockRejectedValue({ code: 'ItemNotFound' })
      } as any);

      const result = await paymentStatusService.getRegistrationByReservationId(validReservationId);

      expect(result).toBeNull();
    });

    it('should throw ValidationError for invalid ULID format', async () => {
      const invalidReservationId = 'invalid-id';

      await expect(
        paymentStatusService.getRegistrationByReservationId(invalidReservationId)
      ).rejects.toThrow(ValidationError);

      expect(mockRegistrationEntity.get).not.toHaveBeenCalled();
    });

    it('should propagate other database errors', async () => {
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockRejectedValue(new Error('Database error'))
      } as any);

      await expect(
        paymentStatusService.getRegistrationByReservationId(validReservationId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getPaymentStatus', () => {
    const validReservationId = generateReservationId();

    it('should return payment status for existing registration', async () => {
      const mockRegistrationData = {
        reservationId: validReservationId,
        eventId: generateReservationId(),
        registrationType: 'individual' as const,
        paymentStatus: true,
        totalParticipants: 1,
        registrationFee: 100,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        paymentDate: '2024-01-01T12:00:00.000Z'
      };

      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockRegistrationData
        })
      } as any);

      const result = await paymentStatusService.getPaymentStatus(validReservationId);

      expect(result).toEqual({
        paymentStatus: true,
        paymentDate: '2024-01-01T12:00:00.000Z'
      });
    });

    it('should return null for non-existent registration', async () => {
      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockRejectedValue({ code: 'ItemNotFound' })
      } as any);

      const result = await paymentStatusService.getPaymentStatus(validReservationId);

      expect(result).toBeNull();
    });
  });

  describe('markAsPaid', () => {
    const validReservationId = generateReservationId();

    it('should mark registration as paid', async () => {
      const mockRegistrationData = {
        reservationId: validReservationId,
        eventId: generateReservationId(),
        registrationType: 'individual' as const,
        paymentStatus: false,
        totalParticipants: 1,
        registrationFee: 100,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        paymentDate: '2024-01-01T00:00:00.000Z'
      };

      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockRegistrationData
        })
      } as any);

      const updatedData = { ...mockRegistrationData, paymentStatus: true };
      mockRegistrationEntity.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: updatedData
          })
        })
      } as any);

      const result = await paymentStatusService.markAsPaid(validReservationId);

      expect(result.paymentStatus).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should use custom payment date when provided', async () => {
      const customPaymentDate = '2024-02-01T12:00:00.000Z';
      const mockRegistrationData = {
        reservationId: validReservationId,
        eventId: generateReservationId(),
        registrationType: 'individual' as const,
        paymentStatus: false,
        totalParticipants: 1,
        registrationFee: 100,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        paymentDate: '2024-01-01T00:00:00.000Z'
      };

      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockRegistrationData
        })
      } as any);

      const updatedData = { ...mockRegistrationData, paymentStatus: true };
      mockRegistrationEntity.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: updatedData
          })
        })
      } as any);

      const result = await paymentStatusService.markAsPaid(validReservationId, customPaymentDate);

      expect(result.paymentDate).toBe(customPaymentDate);
    });
  });

  describe('markAsUnpaid', () => {
    const validReservationId = generateReservationId();

    it('should mark registration as unpaid', async () => {
      const mockRegistrationData = {
        reservationId: validReservationId,
        eventId: generateReservationId(),
        registrationType: 'individual' as const,
        paymentStatus: true,
        totalParticipants: 1,
        registrationFee: 100,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        paymentDate: '2024-01-01T12:00:00.000Z'
      };

      mockRegistrationEntity.get.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockRegistrationData
        })
      } as any);

      const updatedData = { ...mockRegistrationData, paymentStatus: false };
      mockRegistrationEntity.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: updatedData
          })
        })
      } as any);

      const result = await paymentStatusService.markAsUnpaid(validReservationId);

      expect(result.paymentStatus).toBe(false);
      expect(result.success).toBe(true);
    });
  });

  describe('ULID validation edge cases', () => {
    it('should reject empty string as reservation ID', async () => {
      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: '',
          paymentStatus: true
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject null as reservation ID', async () => {
      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: null as any,
          paymentStatus: true
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject undefined as reservation ID', async () => {
      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: undefined as any,
          paymentStatus: true
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject reservation ID with invalid characters', async () => {
      const invalidId = '01ARZ3NDEKTSV4RRFFQ69G5FA@'; // Contains invalid character @

      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: invalidId,
          paymentStatus: true
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject reservation ID with wrong length', async () => {
      const shortId = '01ARZ3NDEKTSV4RRFFQ69G5FA'; // 25 characters instead of 26
      const longId = '01ARZ3NDEKTSV4RRFFQ69G5FAVV'; // 27 characters instead of 26

      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: shortId,
          paymentStatus: true
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        paymentStatusService.updatePaymentStatus({
          reservationId: longId,
          paymentStatus: true
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});