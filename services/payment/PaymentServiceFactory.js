/**
 * @fileoverview Payment Service Factory - Selects payment gateway based on configuration
 * @module services/payment/PaymentServiceFactory
 */

import MockPaymentService from './MockPaymentService.js';
import RazorpayService from './RazorpayService.js';

/**
 * Payment Service Factory
 * Returns appropriate payment service based on PAYMENT_GATEWAY environment variable
 *
 * Supported gateways:
 * - MOCK (default): Auto-succeed payments for development
 * - RAZORPAY: Razorpay payment gateway
 */
class PaymentServiceFactory {
  /**
   * Get payment service instance based on environment configuration
   * @returns {PaymentService} Payment service instance
   */
  static getPaymentService() {
    const gateway = (process.env.PAYMENT_GATEWAY || 'MOCK').toUpperCase();

    switch (gateway) {
      case 'RAZORPAY':
        return new RazorpayService();

      case 'MOCK':
      default:
        if (gateway !== 'MOCK') {
          console.warn(`Unknown payment gateway: ${gateway}. Falling back to MOCK.`);
        }
        return new MockPaymentService();
    }
  }

  /**
   * Get available payment gateways
   * @returns {Array<String>} List of available gateway names
   */
  static getAvailableGateways() {
    return ['MOCK', 'RAZORPAY'];
  }
}

export default PaymentServiceFactory;
