import { RegistrationEntity, RegistrationItem } from '../models/registration.model';
import { isValidReservationId } from '@/shared/utils/ulid';
import { NotFoundError, ValidationError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';

const logger = createFeatureLogger('registrations');

export interface PaymentStatusUpdateData {
  reservationId: string;
  paymentStatus: boolean;
  paymentDate?: string;
}

export interface PaymentStatusUpdateResult {
  success: boolean;
  reservationId: string;
  paymentStatus: boolean;
  paymentDate: string;
  totalParticipants: number;
}

export class PaymentStatusService {
  /**
   * Update payment status for a registration using ULID-based reservation ID
   * This affects all participants covered by the reservation
   */
  async updatePaymentStatus(data: PaymentStatusUpdateData): Promise<PaymentStatusUpdateResult> {
    const { reservationId, paymentStatus, paymentDate } = data;

    // Validate ULID format for reservation ID
    if (!isValidReservationId(reservationId)) {
      logger.error({ reservationId }, 'Invalid reservation ID format');
      throw new ValidationError('Reservation ID must be a valid ULID format', {
        field: 'reservationId',
        value: reservationId,
        expected: 'ULID format (26 characters)'
      });
    }

    try {
      // First, check if the registration exists
      const existingRegistration = await this.getRegistrationByReservationId(reservationId);

      if (!existingRegistration) {
        logger.error({ reservationId }, 'Registration not found');
        throw new NotFoundError('Registration not found', {
          reservationId
        });
      }

      // Validate payment status transition (optional business rule)
      if (existingRegistration.paymentStatus === paymentStatus) {
        logger.warn({
          reservationId,
          currentStatus: existingRegistration.paymentStatus,
          newStatus: paymentStatus
        }, 'Payment status unchanged');
      }

      // Prepare update data
      const updateDate = paymentDate || new Date().toISOString();
      const updateData = {
        paymentStatus,
        updatedAt: updateDate,
        // Update paymentDate when marking as paid
        ...(paymentStatus && { paymentDate: updateDate })
      };

      // Update the registration entity
      const updatedRegistration = await RegistrationEntity.update({
        reservationId
      }).set(updateData).go();

      logger.info({
        reservationId,
        paymentStatus,
        totalParticipants: updatedRegistration.data?.totalParticipants,
        paymentDate: updateDate
      }, 'Payment status updated successfully');

      return {
        success: true,
        reservationId,
        paymentStatus,
        paymentDate: updateDate,
        totalParticipants: updatedRegistration.data?.totalParticipants || 0
      };

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error({
        reservationId,
        paymentStatus,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update payment status');

      throw new Error(`Failed to update payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get registration by reservation ID with ULID validation
   */
  async getRegistrationByReservationId(reservationId: string): Promise<RegistrationItem | null> {
    // Validate ULID format
    if (!isValidReservationId(reservationId)) {
      throw new ValidationError('Reservation ID must be a valid ULID format', {
        field: 'reservationId',
        value: reservationId,
        expected: 'ULID format (26 characters)'
      });
    }

    try {
      const result = await RegistrationEntity.get({
        reservationId
      }).go();

      return result.data as RegistrationItem || null;
    } catch (error) {
      // ElectroDB throws an error when item is not found
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ItemNotFound') {
        return null;
      }

      logger.error({
        reservationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get registration');

      throw error;
    }
  }

  /**
   * Get payment status for a reservation
   */
  async getPaymentStatus(reservationId: string): Promise<{ paymentStatus: boolean; paymentDate?: string } | null> {
    const registration = await this.getRegistrationByReservationId(reservationId);

    if (!registration) {
      return null;
    }

    return {
      paymentStatus: registration.paymentStatus,
      paymentDate: registration.paymentDate
    };
  }

  /**
   * Mark registration as paid
   */
  async markAsPaid(reservationId: string, paymentDate?: string): Promise<PaymentStatusUpdateResult> {
    return this.updatePaymentStatus({
      reservationId,
      paymentStatus: true,
      paymentDate
    });
  }

  /**
   * Mark registration as unpaid
   */
  async markAsUnpaid(reservationId: string): Promise<PaymentStatusUpdateResult> {
    return this.updatePaymentStatus({
      reservationId,
      paymentStatus: false
    });
  }
}

// Export singleton instance
export const paymentStatusService = new PaymentStatusService();
