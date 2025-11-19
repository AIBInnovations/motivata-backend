/**
 * @fileoverview Payment Service Interface - Base class for payment gateway implementations
 * @module services/payment/PaymentService
 */

/**
 * Abstract Payment Service class
 * All payment gateway implementations should extend this class
 */
class PaymentService {
  /**
   * Create a payment order
   * @param {Object} orderData - Order details
   * @param {Number} orderData.amount - Amount in rupees
   * @param {String} orderData.currency - Currency code (default: INR)
   * @param {String} orderData.receipt - Receipt/order reference
   * @param {Object} orderData.notes - Additional notes
   * @returns {Promise<Object>} Order details
   */
  async createOrder(orderData) {
    throw new Error('createOrder method must be implemented');
  }

  /**
   * Verify payment signature/transaction
   * @param {Object} paymentData - Payment verification data
   * @param {String} paymentData.orderId - Order ID
   * @param {String} paymentData.paymentId - Payment ID from gateway
   * @param {String} paymentData.signature - Payment signature
   * @returns {Promise<Boolean>} Verification result
   */
  async verifyPayment(paymentData) {
    throw new Error('verifyPayment method must be implemented');
  }

  /**
   * Get payment gateway configuration
   * @returns {Object} Gateway configuration for client
   */
  getGatewayConfig() {
    throw new Error('getGatewayConfig method must be implemented');
  }

  /**
   * Get payment gateway name
   * @returns {String} Gateway name
   */
  getGatewayName() {
    throw new Error('getGatewayName method must be implemented');
  }
}

export default PaymentService;
