/**
 * @fileoverview Mock Payment Service - For development/testing without real payment gateway
 * @module services/payment/MockPaymentService
 */

import crypto from 'crypto';
import PaymentService from './PaymentService.js';

/**
 * Mock Payment Service
 * Simulates successful payment flow for development
 */
class MockPaymentService extends PaymentService {
  /**
   * Create a mock payment order
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} Mock order details
   */
  async createOrder(orderData) {
    const { amount, currency = 'INR', receipt, notes = {} } = orderData;

    // Generate mock order ID
    const orderId = `order_mock_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    return {
      id: orderId,
      entity: 'order',
      amount: Math.round(amount * 100), // Convert to paise
      amount_paid: 0,
      amount_due: Math.round(amount * 100),
      currency,
      receipt,
      status: 'created',
      attempts: 0,
      notes,
      created_at: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Verify mock payment (always returns true for development)
   * @param {Object} paymentData - Payment verification data
   * @returns {Promise<Boolean>} Always true for mock
   */
  async verifyPayment(paymentData) {
    // In mock mode, always verify as successful
    return true;
  }

  /**
   * Generate mock payment ID for successful payment
   * @param {String} orderId - Order ID
   * @returns {String} Mock payment ID
   */
  generateMockPaymentId(orderId) {
    return `pay_mock_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate mock payment signature
   * @param {String} orderId - Order ID
   * @param {String} paymentId - Payment ID
   * @returns {String} Mock signature
   */
  generateMockSignature(orderId, paymentId) {
    return crypto
      .createHmac('sha256', 'mock_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  /**
   * Get mock gateway configuration
   * @returns {Object} Mock gateway config
   */
  getGatewayConfig() {
    return {
      keyId: 'mock_key_id',
      name: 'Mock Payment Gateway',
      description: 'Development mode - payments auto-succeed',
      mode: 'test'
    };
  }

  /**
   * Get gateway name
   * @returns {String} Gateway name
   */
  getGatewayName() {
    return 'MOCK';
  }
}

export default MockPaymentService;
