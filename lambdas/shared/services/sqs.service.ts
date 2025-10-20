/**
 * SQS service for publishing messages to queues
 */

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { createFeatureLogger } from '@/shared/logger';

const logger = createFeatureLogger('sqs');

/**
 * SQS service class for publishing messages
 */
export class SQSService {
  private client: SQSClient;

  constructor() {
    this.client = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Publish a message to an SQS queue
   * @param queueUrl - The URL of the SQS queue
   * @param message - The message object to send
   * @param messageGroupId - Optional message group ID for FIFO queues
   * @returns Promise<string> - The message ID
   */
  async publishMessage(
    queueUrl: string,
    message: any,
    messageGroupId?: string
  ): Promise<string> {
    try {
      const messageBody = JSON.stringify(message);

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
        MessageGroupId: messageGroupId,
      });

      logger.debug({
        queueUrl,
        messageType: message.type,
        messageSize: messageBody.length,
      }, 'Publishing message to SQS');

      const result = await this.client.send(command);

      if (!result.MessageId) {
        throw new Error('Failed to get message ID from SQS response');
      }

      logger.info({
        messageId: result.MessageId,
        queueUrl,
        messageType: message.type,
      }, 'Message published to SQS successfully');

      return result.MessageId;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        queueUrl,
        messageType: message.type,
      }, 'Failed to publish message to SQS');

      throw error;
    }
  }

  /**
   * Publish a message with error handling that doesn't throw
   * Useful for non-critical operations where failure shouldn't block the main flow
   * @param queueUrl - The URL of the SQS queue
   * @param message - The message object to send
   * @param messageGroupId - Optional message group ID for FIFO queues
   * @returns Promise<boolean> - True if successful, false if failed
   */
  async publishMessageSafe(
    queueUrl: string,
    message: any,
    messageGroupId?: string
  ): Promise<boolean> {
    try {
      await this.publishMessage(queueUrl, message, messageGroupId);
      return true;
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        queueUrl,
        messageType: message.type,
      }, 'Failed to publish message to SQS (safe mode)');

      return false;
    }
  }
}

// Export singleton instance
export const sqsService = new SQSService();
