/**
 * Notify — lightweight wrapper around Knock for payment notifications.
 * Uses KNOCK_SECRET_API_KEY env var. Skips gracefully if not configured.
 */

import { logger } from '../logger.js';

interface PaymentSentData {
  amount: number;
  currency: string;
  beneficiary: string;
  reference?: string;
  payment_id: string;
}

/**
 * Trigger a Knock notification for a successful payment.
 * Fire-and-forget — never throws, logs errors only.
 */
export async function notifyPaymentSent(
  userId: string,
  data: PaymentSentData,
): Promise<void> {
  const apiKey = process.env.KNOCK_SECRET_API_KEY;
  if (!apiKey) {
    logger.debug({ userId }, 'KNOCK_SECRET_API_KEY not set — skipping payment notification');
    return;
  }

  try {
    // Dynamic import to avoid top-level module resolution errors in test environments
    const { Knock } = await import('@knocklabs/node');
    const knock = new Knock(apiKey);

    await knock.workflows.trigger('payment_sent', {
      recipients: [userId],
      data: {
        amount: data.amount,
        currency: data.currency,
        beneficiary: data.beneficiary,
        reference: data.reference,
        payment_id: data.payment_id,
        formatted_amount: `£${data.amount.toFixed(2)}`,
      },
    });

    logger.info({ userId, paymentId: data.payment_id }, 'Knock payment_sent notification triggered');
  } catch (err: any) {
    // Non-critical — payment already processed, notification is best-effort
    logger.error({ err: err.message, userId }, 'Knock notification failed');
  }
}
