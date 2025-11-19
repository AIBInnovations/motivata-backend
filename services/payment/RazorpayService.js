/**
 * @fileoverview Razorpay Payment Service - Real payment gateway integration
 * @module services/payment/RazorpayService
 */

import crypto from 'crypto';
import PaymentService from './PaymentService.js';

/**
 * Razorpay Payment Service
 * To use this service:
 * 1. Install razorpay: npm install razorpay
 * 2. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env
 * 3. Change PAYMENT_GATEWAY in .env to 'RAZORPAY'
 */
class RazorpayService extends PaymentService {
  constructor() {
    super();

    // Only initialize Razorpay if credentials are available
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        // Dynamic import to avoid errors if razorpay is not installed
        import('razorpay').then((Razorpay) => {
          this.razorpay = new Razorpay.default({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
          });
        }).catch(() => {
          console.warn('Razorpay package not installed. Run: npm install razorpay');
        });
      } catch (error) {
        console.warn('Failed to initialize Razorpay:', error.message);
      }
    }
  }

  /**
   * Create a Razorpay order
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} Razorpay order details
   */
  async createOrder(orderData) {
    if (!this.razorpay) {
      throw new Error('Razorpay is not initialized. Check credentials and package installation.');
    }

    const { amount, currency = 'INR', receipt, notes = {} } = orderData;

    const razorpayOrder = await this.razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt,
      notes
    });

    return razorpayOrder;
  }

  /**
   * Verify Razorpay payment signature
   * @param {Object} paymentData - Payment verification data
   * @returns {Promise<Boolean>} Verification result
   */
  async verifyPayment(paymentData) {
    const { orderId, paymentId, signature } = paymentData;

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return generatedSignature === signature;
  }

  /**
   * Get Razorpay gateway configuration
   * @returns {Object} Razorpay config for client
   */
  getGatewayConfig() {
    return {
      keyId: process.env.RAZORPAY_KEY_ID,
      name: 'Razorpay',
      description: 'Secure payment gateway',
      mode: process.env.NODE_ENV === 'production' ? 'live' : 'test'
    };
  }

  /**
   * Get gateway name
   * @returns {String} Gateway name
   */
  getGatewayName() {
    return 'RAZORPAY';
  }
}

export default RazorpayService;
