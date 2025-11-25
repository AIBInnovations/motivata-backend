# WordPress + Node.js Razorpay Backend Integration Guide

Complete implementation guide for integrating your custom Node.js Razorpay backend with WordPress (without WooCommerce Razorpay plugin).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Backend Configuration](#backend-configuration)
4. [WordPress Implementation](#wordpress-implementation)
   - [PHP Functions](#php-functions)
   - [JavaScript Handler](#javascript-handler)
   - [CSS Styling](#css-styling)
5. [WordPress Pages Setup](#wordpress-pages-setup)
6. [Shortcodes & Usage](#shortcodes--usage)
7. [Testing Guide](#testing-guide)
8. [Security Checklist](#security-checklist)
9. [Troubleshooting](#troubleshooting)
10. [Advanced Features](#advanced-features)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Payment Flow                              │
└─────────────────────────────────────────────────────────────────┘

WordPress Frontend
      │
      │ 1. User clicks "Pay Now"
      ▼
WordPress AJAX Handler (PHP)
      │
      │ 2. Create order request
      ▼
Node.js Backend API (/api/web/razorpay/create-order)
      │
      │ 3. Create Razorpay order & payment link
      ▼
Razorpay Payment Gateway
      │
      │ 4. User completes payment
      ▼
Razorpay Webhook (/api/web/razorpay/webhook)
      │
      │ 5. Payment status update
      ▼
Node.js Backend (Database Updated)
      │
      │ 6. User redirected to callback URL
      ▼
WordPress Frontend (Status Check via Long Polling)
      │
      │ 7. Check payment status
      ▼
Node.js Backend API (/api/web/razorpay/status/:orderId)
      │
      │ 8. Return payment status
      ▼
WordPress Success/Failure Page
```

**Key Points:**
- WordPress frontend interacts with Node.js backend via AJAX
- Razorpay sends webhooks directly to Node.js backend
- WordPress uses long polling to check payment status
- No payment data stored in WordPress database

---

## Prerequisites

### Required
- ✅ WordPress 5.0+ installed and running
- ✅ Node.js backend with Razorpay integration (already implemented)
- ✅ Razorpay account with API keys
- ✅ SSL certificate (HTTPS) for both WordPress and backend
- ✅ Backend publicly accessible for webhooks

### Environment Variables (Backend)
Ensure these are set in your Node.js backend `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=https://your-wordpress-site.com
```

---

## Backend Configuration

### 1. Update CORS Settings

**File:** `server.js` or `app.js` (your main Express file)

Add WordPress domain to CORS whitelist:

```javascript
import cors from 'cors';

const allowedOrigins = [
  'http://localhost:3000',
  'https://your-wordpress-site.com',
  'https://www.your-wordpress-site.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

### 2. Verify Webhook Configuration

**File:** `src/razorpay/razorpay.webhook.js`

Ensure webhook handler is working:

```bash
# Test webhook endpoint
curl -X POST https://your-backend-domain.com/api/web/razorpay/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: test" \
  -d '{"event":"payment.captured","payload":{}}'
```

### 3. Configure Razorpay Dashboard

1. Login to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Go to **Settings → Webhooks**
3. Click **"+ Add New Webhook"**
4. Configure:
   - **Webhook URL:** `https://your-backend-domain.com/api/web/razorpay/webhook`
   - **Secret:** Use your `RAZORPAY_KEY_SECRET` value
   - **Alert Email:** Your email
   - **Active Events:** Select all or these specific events:
     - ✅ payment.captured
     - ✅ payment.failed
     - ✅ order.paid
     - ✅ payment_link.paid
     - ✅ payment_link.cancelled
     - ✅ payment_link.expired
     - ✅ refund.created
     - ✅ refund.processed
5. Click **"Create Webhook"**

---

## WordPress Implementation

### PHP Functions

**Location:** `wp-content/themes/your-theme/functions.php`

Or create a custom plugin: `wp-content/plugins/razorpay-integration/razorpay-integration.php`

```php
<?php
/**
 * Plugin Name: Razorpay Payment Integration
 * Plugin URI: https://your-site.com
 * Description: Integration with custom Node.js Razorpay backend
 * Version: 1.0.0
 * Author: Your Name
 * Author URI: https://your-site.com
 * License: GPL v2 or later
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// ============================================
// Configuration
// ============================================

define('RAZORPAY_API_BASE', 'https://your-backend-domain.com/api/web/razorpay');
define('RAZORPAY_TIMEOUT', 30); // API request timeout in seconds

// ============================================
// API Helper Functions
// ============================================

/**
 * Create Razorpay payment order
 *
 * @param float $amount Amount in INR
 * @param string $type Payment type (EVENT, SESSION, PRODUCT, OTHER)
 * @param string|null $event_id Event ID (optional)
 * @param string|null $session_id Session ID (optional)
 * @param array $metadata Additional metadata
 * @return array API response
 */
function razorpay_create_order($amount, $type, $event_id = null, $session_id = null, $metadata = []) {
    $url = RAZORPAY_API_BASE . '/create-order';

    // Prepare request body
    $body = array(
        'amount' => floatval($amount),
        'currency' => 'INR',
        'type' => $type
    );

    // Add event ID if provided
    if ($event_id) {
        $body['eventId'] = $event_id;
    }

    // Add session ID if provided
    if ($session_id) {
        $body['sessionId'] = $session_id;
    }

    // Prepare metadata with customer details
    $default_metadata = array(
        'callbackUrl' => home_url('/payment-callback/'),
        'customerName' => '',
        'customerEmail' => '',
        'customerPhone' => ''
    );

    // Get user details if logged in
    if (is_user_logged_in()) {
        $current_user = wp_get_current_user();
        $default_metadata['customerName'] = $current_user->display_name;
        $default_metadata['customerEmail'] = $current_user->user_email;
        $default_metadata['customerPhone'] = get_user_meta($current_user->ID, 'billing_phone', true);
    }

    // Merge with provided metadata
    $body['metadata'] = array_merge($default_metadata, $metadata);

    // Prepare headers
    $headers = array(
        'Content-Type' => 'application/json'
    );

    // Add authorization if user is logged in
    if (is_user_logged_in()) {
        $token = get_user_meta(get_current_user_id(), 'auth_token', true);
        if ($token) {
            $headers['Authorization'] = 'Bearer ' . $token;
        }
    }

    // Make API request
    $response = wp_remote_post($url, array(
        'headers' => $headers,
        'body' => json_encode($body),
        'timeout' => RAZORPAY_TIMEOUT,
        'data_format' => 'body'
    ));

    // Handle errors
    if (is_wp_error($response)) {
        error_log('Razorpay Create Order Error: ' . $response->get_error_message());
        return array(
            'success' => false,
            'error' => $response->get_error_message()
        );
    }

    // Parse response
    $response_code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);

    if ($response_code !== 201) {
        error_log('Razorpay API Error: ' . json_encode($body));
        return array(
            'success' => false,
            'error' => isset($body['message']) ? $body['message'] : 'Failed to create order'
        );
    }

    return array(
        'success' => true,
        'data' => $body['data']
    );
}

/**
 * Get payment status by order ID
 *
 * @param string $order_id Razorpay order ID
 * @return array API response
 */
function razorpay_get_payment_status($order_id) {
    $url = RAZORPAY_API_BASE . '/status/' . urlencode($order_id);

    // Prepare headers
    $headers = array();

    // Add authorization if user is logged in
    if (is_user_logged_in()) {
        $token = get_user_meta(get_current_user_id(), 'auth_token', true);
        if ($token) {
            $headers['Authorization'] = 'Bearer ' . $token;
        }
    }

    // Make API request
    $response = wp_remote_get($url, array(
        'headers' => $headers,
        'timeout' => RAZORPAY_TIMEOUT
    ));

    // Handle errors
    if (is_wp_error($response)) {
        error_log('Razorpay Get Status Error: ' . $response->get_error_message());
        return array(
            'success' => false,
            'error' => $response->get_error_message()
        );
    }

    // Parse response
    $response_code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);

    if ($response_code !== 200) {
        error_log('Razorpay Status API Error: ' . json_encode($body));
        return array(
            'success' => false,
            'error' => isset($body['message']) ? $body['message'] : 'Failed to get payment status'
        );
    }

    return array(
        'success' => true,
        'data' => $body['data']
    );
}

// ============================================
// AJAX Handlers
// ============================================

/**
 * AJAX handler for creating order
 * Endpoint: wp-admin/admin-ajax.php?action=razorpay_create_order
 */
add_action('wp_ajax_razorpay_create_order', 'ajax_razorpay_create_order');
add_action('wp_ajax_nopriv_razorpay_create_order', 'ajax_razorpay_create_order');

function ajax_razorpay_create_order() {
    // Verify nonce for security
    check_ajax_referer('razorpay_nonce', 'nonce');

    // Validate required fields
    if (!isset($_POST['amount']) || !isset($_POST['type'])) {
        wp_send_json_error(array(
            'message' => 'Amount and type are required'
        ), 400);
    }

    // Sanitize inputs
    $amount = floatval($_POST['amount']);
    $type = sanitize_text_field($_POST['type']);
    $event_id = isset($_POST['event_id']) ? sanitize_text_field($_POST['event_id']) : null;
    $session_id = isset($_POST['session_id']) ? sanitize_text_field($_POST['session_id']) : null;

    // Parse metadata if provided
    $metadata = array();
    if (isset($_POST['metadata'])) {
        $metadata = json_decode(stripslashes($_POST['metadata']), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $metadata = array();
        }
    }

    // Override customer details from POST if provided
    if (isset($_POST['customer_name'])) {
        $metadata['customerName'] = sanitize_text_field($_POST['customer_name']);
    }
    if (isset($_POST['customer_email'])) {
        $metadata['customerEmail'] = sanitize_email($_POST['customer_email']);
    }
    if (isset($_POST['customer_phone'])) {
        $metadata['customerPhone'] = sanitize_text_field($_POST['customer_phone']);
    }

    // Handle club/combo purchases with multiple customers
    if (isset($_POST['customers'])) {
        $customers_data = json_decode(stripslashes($_POST['customers']), true);
        if (is_array($customers_data)) {
            $customers = array();
            foreach ($customers_data as $customer) {
                $customers[] = array(
                    'name' => sanitize_text_field($customer['name']),
                    'email' => sanitize_email($customer['email']),
                    'phone' => sanitize_text_field($customer['phone'])
                );
            }
            $metadata['customers'] = $customers;
        }
    }

    // Create order via backend API
    $result = razorpay_create_order($amount, $type, $event_id, $session_id, $metadata);

    if ($result['success']) {
        wp_send_json_success($result['data']);
    } else {
        wp_send_json_error(array(
            'message' => $result['error']
        ), 500);
    }
}

/**
 * AJAX handler for checking payment status
 * Endpoint: wp-admin/admin-ajax.php?action=razorpay_check_status
 */
add_action('wp_ajax_razorpay_check_status', 'ajax_razorpay_check_status');
add_action('wp_ajax_nopriv_razorpay_check_status', 'ajax_razorpay_check_status');

function ajax_razorpay_check_status() {
    // Verify nonce
    check_ajax_referer('razorpay_nonce', 'nonce');

    // Validate order ID
    if (!isset($_POST['order_id'])) {
        wp_send_json_error(array(
            'message' => 'Order ID is required'
        ), 400);
    }

    $order_id = sanitize_text_field($_POST['order_id']);

    // Get payment status from backend API
    $result = razorpay_get_payment_status($order_id);

    if ($result['success']) {
        wp_send_json_success($result['data']);
    } else {
        wp_send_json_error(array(
            'message' => $result['error']
        ), 500);
    }
}

// ============================================
// Enqueue Scripts & Styles
// ============================================

add_action('wp_enqueue_scripts', 'razorpay_enqueue_assets');

function razorpay_enqueue_assets() {
    // Enqueue JavaScript
    wp_enqueue_script(
        'razorpay-payment-handler',
        get_template_directory_uri() . '/js/razorpay-payment.js',
        array('jquery'),
        '1.0.0',
        true
    );

    // Localize script with AJAX data
    wp_localize_script('razorpay-payment-handler', 'razorpayConfig', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('razorpay_nonce'),
        'homeUrl' => home_url(),
        'callbackUrl' => home_url('/payment-callback/'),
        'successUrl' => home_url('/payment-success/'),
        'failureUrl' => home_url('/payment-failed/')
    ));

    // Enqueue CSS
    wp_enqueue_style(
        'razorpay-payment-styles',
        get_template_directory_uri() . '/css/razorpay-payment.css',
        array(),
        '1.0.0'
    );
}

// ============================================
// Shortcodes
// ============================================

/**
 * Shortcode for single payment button
 * Usage: [razorpay_button amount="1500" type="EVENT" event_id="ABC123" text="Pay Now"]
 */
add_shortcode('razorpay_button', 'razorpay_button_shortcode');

function razorpay_button_shortcode($atts, $content = null) {
    $atts = shortcode_atts(array(
        'amount' => '1000',
        'type' => 'EVENT',
        'event_id' => '',
        'session_id' => '',
        'text' => 'Pay Now',
        'class' => 'btn btn-primary razorpay-pay-btn',
        'customer_required' => 'false'
    ), $atts);

    $button_id = 'razorpay-btn-' . uniqid();

    ob_start();
    ?>
    <div class="razorpay-payment-wrapper" id="<?php echo esc_attr($button_id); ?>-wrapper">
        <button
            class="<?php echo esc_attr($atts['class']); ?>"
            id="<?php echo esc_attr($button_id); ?>"
            data-amount="<?php echo esc_attr($atts['amount']); ?>"
            data-type="<?php echo esc_attr($atts['type']); ?>"
            data-event-id="<?php echo esc_attr($atts['event_id']); ?>"
            data-session-id="<?php echo esc_attr($atts['session_id']); ?>"
            data-customer-required="<?php echo esc_attr($atts['customer_required']); ?>"
        >
            <?php echo esc_html($atts['text']); ?>
        </button>
        <div class="razorpay-message" id="<?php echo esc_attr($button_id); ?>-message"></div>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Shortcode for payment form with customer details
 * Usage: [razorpay_form amount="1500" type="EVENT" event_id="ABC123"]
 */
add_shortcode('razorpay_form', 'razorpay_form_shortcode');

function razorpay_form_shortcode($atts, $content = null) {
    $atts = shortcode_atts(array(
        'amount' => '1000',
        'type' => 'EVENT',
        'event_id' => '',
        'session_id' => '',
        'button_text' => 'Proceed to Payment'
    ), $atts);

    $form_id = 'razorpay-form-' . uniqid();
    $current_user = wp_get_current_user();

    ob_start();
    ?>
    <div class="razorpay-payment-form-wrapper">
        <form class="razorpay-payment-form" id="<?php echo esc_attr($form_id); ?>">
            <input type="hidden" name="amount" value="<?php echo esc_attr($atts['amount']); ?>">
            <input type="hidden" name="type" value="<?php echo esc_attr($atts['type']); ?>">
            <input type="hidden" name="event_id" value="<?php echo esc_attr($atts['event_id']); ?>">
            <input type="hidden" name="session_id" value="<?php echo esc_attr($atts['session_id']); ?>">

            <div class="form-group">
                <label for="<?php echo esc_attr($form_id); ?>-name">Full Name *</label>
                <input
                    type="text"
                    id="<?php echo esc_attr($form_id); ?>-name"
                    name="customer_name"
                    required
                    value="<?php echo esc_attr($current_user->display_name); ?>"
                >
            </div>

            <div class="form-group">
                <label for="<?php echo esc_attr($form_id); ?>-email">Email Address *</label>
                <input
                    type="email"
                    id="<?php echo esc_attr($form_id); ?>-email"
                    name="customer_email"
                    required
                    value="<?php echo esc_attr($current_user->user_email); ?>"
                >
            </div>

            <div class="form-group">
                <label for="<?php echo esc_attr($form_id); ?>-phone">Phone Number *</label>
                <input
                    type="tel"
                    id="<?php echo esc_attr($form_id); ?>-phone"
                    name="customer_phone"
                    required
                    placeholder="+919876543210"
                    value="<?php echo esc_attr(get_user_meta($current_user->ID, 'billing_phone', true)); ?>"
                >
            </div>

            <div class="form-group">
                <button type="submit" class="btn btn-primary razorpay-form-submit">
                    <?php echo esc_html($atts['button_text']); ?>
                </button>
            </div>

            <div class="razorpay-message" id="<?php echo esc_attr($form_id); ?>-message"></div>
        </form>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Shortcode for club/combo purchase with multiple customers
 * Usage: [razorpay_club_form amount="4500" type="EVENT" event_id="ABC123" customer_count="3"]
 */
add_shortcode('razorpay_club_form', 'razorpay_club_form_shortcode');

function razorpay_club_form_shortcode($atts, $content = null) {
    $atts = shortcode_atts(array(
        'amount' => '3000',
        'type' => 'EVENT',
        'event_id' => '',
        'customer_count' => '3',
        'button_text' => 'Pay for Group'
    ), $atts);

    $form_id = 'razorpay-club-form-' . uniqid();
    $customer_count = intval($atts['customer_count']);

    ob_start();
    ?>
    <div class="razorpay-club-form-wrapper">
        <form class="razorpay-club-form" id="<?php echo esc_attr($form_id); ?>" data-customer-count="<?php echo esc_attr($customer_count); ?>">
            <input type="hidden" name="amount" value="<?php echo esc_attr($atts['amount']); ?>">
            <input type="hidden" name="type" value="<?php echo esc_attr($atts['type']); ?>">
            <input type="hidden" name="event_id" value="<?php echo esc_attr($atts['event_id']); ?>">

            <h3>Customer Details (<?php echo $customer_count; ?> people)</h3>

            <?php for ($i = 1; $i <= $customer_count; $i++): ?>
            <div class="customer-block">
                <h4>Customer <?php echo $i; ?></h4>

                <div class="form-group">
                    <label for="<?php echo esc_attr($form_id); ?>-name-<?php echo $i; ?>">Full Name *</label>
                    <input
                        type="text"
                        id="<?php echo esc_attr($form_id); ?>-name-<?php echo $i; ?>"
                        name="customers[<?php echo $i-1; ?>][name]"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="<?php echo esc_attr($form_id); ?>-email-<?php echo $i; ?>">Email *</label>
                    <input
                        type="email"
                        id="<?php echo esc_attr($form_id); ?>-email-<?php echo $i; ?>"
                        name="customers[<?php echo $i-1; ?>][email]"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="<?php echo esc_attr($form_id); ?>-phone-<?php echo $i; ?>">Phone *</label>
                    <input
                        type="tel"
                        id="<?php echo esc_attr($form_id); ?>-phone-<?php echo $i; ?>"
                        name="customers[<?php echo $i-1; ?>][phone]"
                        required
                        placeholder="+919876543210"
                    >
                </div>
            </div>
            <?php endfor; ?>

            <div class="form-group">
                <button type="submit" class="btn btn-primary razorpay-club-submit">
                    <?php echo esc_html($atts['button_text']); ?> (₹<?php echo number_format($atts['amount'], 2); ?>)
                </button>
            </div>

            <div class="razorpay-message" id="<?php echo esc_attr($form_id); ?>-message"></div>
        </form>
    </div>
    <?php
    return ob_get_clean();
}

// ============================================
// Admin Settings (Optional)
// ============================================

// You can add a settings page in WordPress admin to configure API URL
// This is optional - for now, it's hardcoded in the constant
```

---

### JavaScript Handler

**Location:** `wp-content/themes/your-theme/js/razorpay-payment.js`

```javascript
/**
 * Razorpay Payment Handler for WordPress
 * Handles payment creation, redirection, and status polling
 */

(function($) {
    'use strict';

    class RazorpayPaymentHandler {
        constructor() {
            this.pollingInterval = null;
            this.pollingAttempts = 0;
            this.maxPollingAttempts = 60; // 3 minutes (60 * 3 seconds)
            this.pollingDelay = 3000; // 3 seconds

            this.init();
        }

        /**
         * Initialize event listeners
         */
        init() {
            // Check if on callback page
            if (this.isCallbackPage()) {
                this.handleCallback();
            }

            // Single button payment
            $(document).on('click', '.razorpay-pay-btn', (e) => {
                e.preventDefault();
                this.handleButtonClick(e.target);
            });

            // Form submission with customer details
            $(document).on('submit', '.razorpay-payment-form', (e) => {
                e.preventDefault();
                this.handleFormSubmit(e.target);
            });

            // Club/combo form submission
            $(document).on('submit', '.razorpay-club-form', (e) => {
                e.preventDefault();
                this.handleClubFormSubmit(e.target);
            });
        }

        /**
         * Check if current page is payment callback
         */
        isCallbackPage() {
            const urlParams = new URLSearchParams(window.location.search);
            return (
                urlParams.has('razorpay_payment_link_id') ||
                urlParams.has('razorpay_payment_link_reference_id') ||
                urlParams.has('razorpay_payment_id') ||
                window.location.pathname.includes('/payment-callback/')
            );
        }

        /**
         * Handle single button click
         */
        async handleButtonClick(button) {
            const $button = $(button);
            const $wrapper = $button.closest('.razorpay-payment-wrapper');
            const $message = $wrapper.find('.razorpay-message');

            // Get data from button
            const amount = parseFloat($button.data('amount'));
            const type = $button.data('type');
            const eventId = $button.data('event-id') || '';
            const sessionId = $button.data('session-id') || '';
            const customerRequired = $button.data('customer-required') === 'true';

            // Validate
            if (!amount || amount <= 0) {
                this.showMessage($message, 'Invalid amount', 'error');
                return;
            }

            // Check if customer details required
            if (customerRequired) {
                this.showMessage($message, 'Please fill in customer details', 'error');
                return;
            }

            // Disable button
            $button.prop('disabled', true).text('Processing...');

            try {
                await this.createAndRedirect({
                    amount,
                    type,
                    event_id: eventId,
                    session_id: sessionId
                }, $message);
            } catch (error) {
                console.error('Payment error:', error);
                this.showMessage($message, error.message || 'Payment failed', 'error');
                $button.prop('disabled', false).text($button.data('original-text') || 'Pay Now');
            }
        }

        /**
         * Handle form submission
         */
        async handleFormSubmit(form) {
            const $form = $(form);
            const $message = $form.find('.razorpay-message');
            const $submitBtn = $form.find('.razorpay-form-submit');

            // Get form data
            const formData = {
                amount: parseFloat($form.find('[name="amount"]').val()),
                type: $form.find('[name="type"]').val(),
                event_id: $form.find('[name="event_id"]').val(),
                session_id: $form.find('[name="session_id"]').val(),
                customer_name: $form.find('[name="customer_name"]').val(),
                customer_email: $form.find('[name="customer_email"]').val(),
                customer_phone: $form.find('[name="customer_phone"]').val()
            };

            // Validate
            if (!formData.customer_name || !formData.customer_email || !formData.customer_phone) {
                this.showMessage($message, 'Please fill all required fields', 'error');
                return;
            }

            // Disable submit button
            const originalText = $submitBtn.text();
            $submitBtn.prop('disabled', true).text('Processing...');

            try {
                await this.createAndRedirect(formData, $message);
            } catch (error) {
                console.error('Payment error:', error);
                this.showMessage($message, error.message || 'Payment failed', 'error');
                $submitBtn.prop('disabled', false).text(originalText);
            }
        }

        /**
         * Handle club/combo form submission
         */
        async handleClubFormSubmit(form) {
            const $form = $(form);
            const $message = $form.find('.razorpay-message');
            const $submitBtn = $form.find('.razorpay-club-submit');
            const customerCount = parseInt($form.data('customer-count'));

            // Collect customer data
            const customers = [];
            for (let i = 0; i < customerCount; i++) {
                const name = $form.find(`[name="customers[${i}][name]"]`).val();
                const email = $form.find(`[name="customers[${i}][email]"]`).val();
                const phone = $form.find(`[name="customers[${i}][phone]"]`).val();

                if (!name || !email || !phone) {
                    this.showMessage($message, `Please fill all fields for Customer ${i + 1}`, 'error');
                    return;
                }

                customers.push({ name, email, phone });
            }

            // Get form data
            const formData = {
                amount: parseFloat($form.find('[name="amount"]').val()),
                type: $form.find('[name="type"]').val(),
                event_id: $form.find('[name="event_id"]').val(),
                customers: JSON.stringify(customers)
            };

            // Disable submit button
            const originalText = $submitBtn.text();
            $submitBtn.prop('disabled', true).text('Processing...');

            try {
                await this.createAndRedirect(formData, $message);
            } catch (error) {
                console.error('Payment error:', error);
                this.showMessage($message, error.message || 'Payment failed', 'error');
                $submitBtn.prop('disabled', false).text(originalText);
            }
        }

        /**
         * Create order and redirect to Razorpay
         */
        async createAndRedirect(data, $message) {
            this.showMessage($message, 'Creating payment order...', 'loading');

            try {
                const response = await $.ajax({
                    url: razorpayConfig.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'razorpay_create_order',
                        nonce: razorpayConfig.nonce,
                        ...data
                    }
                });

                if (!response.success) {
                    throw new Error(response.data?.message || 'Failed to create order');
                }

                const orderData = response.data;
                console.log('Order created:', orderData.orderId);

                // Store order ID in localStorage
                localStorage.setItem('razorpay_current_order', orderData.orderId);
                localStorage.setItem('razorpay_order_data', JSON.stringify({
                    orderId: orderData.orderId,
                    amount: orderData.amount,
                    type: data.type,
                    timestamp: Date.now()
                }));

                this.showMessage($message, 'Redirecting to payment gateway...', 'success');

                // Redirect to Razorpay payment page
                setTimeout(() => {
                    window.location.href = orderData.paymentUrl;
                }, 500);

            } catch (error) {
                console.error('Create order error:', error);
                throw new Error(error.responseJSON?.data?.message || error.message || 'Failed to create payment order');
            }
        }

        /**
         * Handle callback from Razorpay
         */
        async handleCallback() {
            console.log('Payment callback received');

            const orderId = localStorage.getItem('razorpay_current_order');

            if (!orderId) {
                console.error('No order ID found in callback');
                this.showPageMessage('Order ID not found. Please contact support.', 'error');
                return;
            }

            // Show loading message
            this.showPageMessage('Verifying your payment...', 'loading');

            // Start polling for payment status
            this.startPolling(orderId);
        }

        /**
         * Start polling for payment status
         */
        startPolling(orderId) {
            console.log('Starting status polling for:', orderId);
            this.pollingAttempts = 0;

            // First check immediately
            this.checkPaymentStatus(orderId);

            // Then poll every 3 seconds
            this.pollingInterval = setInterval(() => {
                this.checkPaymentStatus(orderId);
            }, this.pollingDelay);
        }

        /**
         * Check payment status via AJAX
         */
        async checkPaymentStatus(orderId) {
            this.pollingAttempts++;
            console.log(`Checking payment status (attempt ${this.pollingAttempts}/${this.maxPollingAttempts})`);

            try {
                const response = await $.ajax({
                    url: razorpayConfig.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'razorpay_check_status',
                        nonce: razorpayConfig.nonce,
                        order_id: orderId
                    }
                });

                if (!response.success) {
                    throw new Error(response.data?.message || 'Failed to check status');
                }

                const paymentData = response.data;
                console.log('Payment status:', paymentData.status);

                // Check status
                if (paymentData.status === 'SUCCESS') {
                    this.handlePaymentSuccess(paymentData);
                } else if (paymentData.status === 'FAILED') {
                    this.handlePaymentFailure(paymentData);
                } else if (this.pollingAttempts >= this.maxPollingAttempts) {
                    this.handlePaymentTimeout(orderId);
                }

            } catch (error) {
                console.error('Status check error:', error);

                if (this.pollingAttempts >= this.maxPollingAttempts) {
                    this.stopPolling();
                    this.showPageMessage('Unable to verify payment status. Please contact support with Order ID: ' + orderId, 'error');
                }
            }
        }

        /**
         * Stop polling
         */
        stopPolling() {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
        }

        /**
         * Handle successful payment
         */
        handlePaymentSuccess(paymentData) {
            console.log('Payment successful!', paymentData);
            this.stopPolling();

            // Clear localStorage
            localStorage.removeItem('razorpay_current_order');
            localStorage.removeItem('razorpay_order_data');

            // Show success message
            this.showPageMessage('Payment successful! Redirecting...', 'success');

            // Redirect to success page
            setTimeout(() => {
                window.location.href = razorpayConfig.successUrl + '?order_id=' + paymentData.orderId;
            }, 2000);
        }

        /**
         * Handle failed payment
         */
        handlePaymentFailure(paymentData) {
            console.log('Payment failed:', paymentData);
            this.stopPolling();

            // Clear localStorage
            localStorage.removeItem('razorpay_current_order');
            localStorage.removeItem('razorpay_order_data');

            // Show error message
            const reason = paymentData.failureReason || 'Unknown error';
            this.showPageMessage('Payment failed: ' + reason, 'error');

            // Redirect to failure page
            setTimeout(() => {
                window.location.href = razorpayConfig.failureUrl + '?order_id=' + paymentData.orderId + '&reason=' + encodeURIComponent(reason);
            }, 3000);
        }

        /**
         * Handle payment verification timeout
         */
        handlePaymentTimeout(orderId) {
            console.log('Payment verification timeout');
            this.stopPolling();

            this.showPageMessage(
                'Payment verification is taking longer than expected. Your payment may still be processing. Order ID: ' + orderId,
                'warning'
            );

            // Redirect to success page with pending status
            setTimeout(() => {
                window.location.href = razorpayConfig.successUrl + '?order_id=' + orderId + '&status=pending';
            }, 5000);
        }

        /**
         * Show message in element
         */
        showMessage($element, message, type) {
            const iconMap = {
                'success': '✓',
                'error': '✗',
                'warning': '⚠',
                'loading': '⏳'
            };

            const icon = iconMap[type] || '';
            $element.html(`<div class="razorpay-message-${type}">${icon} ${message}</div>`).show();
        }

        /**
         * Show full page message
         */
        showPageMessage(message, type) {
            const $container = $('#razorpay-callback-message');

            if ($container.length) {
                this.showMessage($container, message, type);
            } else {
                // Create message container if doesn't exist
                $('body').prepend(`<div id="razorpay-callback-message" class="razorpay-page-message"></div>`);
                this.showMessage($('#razorpay-callback-message'), message, type);
            }
        }
    }

    // Initialize when document is ready
    $(document).ready(function() {
        window.razorpayHandler = new RazorpayPaymentHandler();
    });

})(jQuery);
```

---

### CSS Styling

**Location:** `wp-content/themes/your-theme/css/razorpay-payment.css`

```css
/**
 * Razorpay Payment Styles
 */

/* ============================================
   Payment Wrapper
   ============================================ */

.razorpay-payment-wrapper {
    margin: 20px 0;
}

/* ============================================
   Payment Buttons
   ============================================ */

.razorpay-pay-btn {
    background-color: #528FF0;
    color: #ffffff;
    border: none;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-block;
    text-align: center;
    text-decoration: none;
}

.razorpay-pay-btn:hover {
    background-color: #3c7dd6;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(82, 143, 240, 0.3);
}

.razorpay-pay-btn:active {
    transform: translateY(0);
}

.razorpay-pay-btn:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

/* ============================================
   Payment Forms
   ============================================ */

.razorpay-payment-form-wrapper,
.razorpay-club-form-wrapper {
    max-width: 600px;
    margin: 30px auto;
    padding: 30px;
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.razorpay-payment-form h3,
.razorpay-club-form h3 {
    margin-top: 0;
    margin-bottom: 20px;
    color: #333;
    font-size: 24px;
}

.razorpay-club-form .customer-block {
    padding: 20px;
    background: #f9f9f9;
    border-radius: 6px;
    margin-bottom: 20px;
}

.razorpay-club-form .customer-block h4 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #555;
    font-size: 18px;
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
    font-size: 14px;
}

.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="tel"] {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    transition: border-color 0.3s ease;
    box-sizing: border-box;
}

.form-group input:focus {
    outline: none;
    border-color: #528FF0;
    box-shadow: 0 0 0 3px rgba(82, 143, 240, 0.1);
}

.form-group button[type="submit"] {
    width: 100%;
    background-color: #528FF0;
    color: #ffffff;
    border: none;
    padding: 14px 24px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.form-group button[type="submit"]:hover {
    background-color: #3c7dd6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(82, 143, 240, 0.3);
}

.form-group button[type="submit"]:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
    transform: none;
}

/* ============================================
   Messages
   ============================================ */

.razorpay-message {
    margin-top: 15px;
    padding: 12px;
    border-radius: 4px;
    font-size: 14px;
    display: none;
}

.razorpay-message-success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
    padding: 12px;
    border-radius: 4px;
}

.razorpay-message-error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    padding: 12px;
    border-radius: 4px;
}

.razorpay-message-warning {
    background-color: #fff3cd;
    color: #856404;
    border: 1px solid #ffeeba;
    padding: 12px;
    border-radius: 4px;
}

.razorpay-message-loading {
    background-color: #d1ecf1;
    color: #0c5460;
    border: 1px solid #bee5eb;
    padding: 12px;
    border-radius: 4px;
}

/* ============================================
   Page Messages (Callback Page)
   ============================================ */

.razorpay-page-message {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    max-width: 600px;
    width: 90%;
    z-index: 9999;
    animation: slideDown 0.3s ease;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

/* ============================================
   Callback Page Styles
   ============================================ */

.payment-callback-container,
.payment-success-container,
.payment-failed-container {
    max-width: 600px;
    margin: 100px auto;
    padding: 40px;
    text-align: center;
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
}

.payment-callback-container h1,
.payment-success-container h1,
.payment-failed-container h1 {
    margin-top: 0;
    font-size: 32px;
}

.payment-success-container h1 {
    color: #28a745;
}

.payment-failed-container h1 {
    color: #dc3545;
}

.payment-callback-container p,
.payment-success-container p,
.payment-failed-container p {
    font-size: 16px;
    color: #666;
    margin: 15px 0;
}

.spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #528FF0;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 20px auto;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.btn {
    display: inline-block;
    padding: 12px 24px;
    margin-top: 20px;
    background-color: #528FF0;
    color: #ffffff;
    text-decoration: none;
    border-radius: 4px;
    font-weight: 600;
    transition: all 0.3s ease;
}

.btn:hover {
    background-color: #3c7dd6;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(82, 143, 240, 0.3);
}

/* ============================================
   Responsive Design
   ============================================ */

@media (max-width: 768px) {
    .razorpay-payment-form-wrapper,
    .razorpay-club-form-wrapper {
        padding: 20px;
        margin: 20px 10px;
    }

    .payment-callback-container,
    .payment-success-container,
    .payment-failed-container {
        margin: 50px 20px;
        padding: 30px 20px;
    }

    .razorpay-pay-btn {
        width: 100%;
        display: block;
    }
}
```

---

## WordPress Pages Setup

### 1. Create Payment Callback Page

**Page Title:** Payment Callback
**Slug:** `payment-callback`
**Template:** Create custom template

**File:** `wp-content/themes/your-theme/page-payment-callback.php`

```php
<?php
/**
 * Template Name: Payment Callback
 * Description: Handles Razorpay payment callback and status verification
 */

get_header();
?>

<div class="payment-callback-container">
    <h1>Processing Your Payment</h1>
    <div id="razorpay-callback-message">
        <div class="spinner"></div>
        <p>Please wait while we verify your payment...</p>
        <p><small>Do not close this window or press the back button.</small></p>
    </div>
</div>

<?php get_footer(); ?>
```

### 2. Create Payment Success Page

**Page Title:** Payment Success
**Slug:** `payment-success`

**File:** `wp-content/themes/your-theme/page-payment-success.php`

```php
<?php
/**
 * Template Name: Payment Success
 * Description: Display payment success confirmation
 */

get_header();

$order_id = isset($_GET['order_id']) ? sanitize_text_field($_GET['order_id']) : '';
$status = isset($_GET['status']) ? sanitize_text_field($_GET['status']) : 'success';
?>

<div class="payment-success-container">
    <?php if ($status === 'pending'): ?>
        <h1>Payment Verification Pending</h1>
        <p>Your payment is being processed. We'll send you a confirmation email shortly.</p>
    <?php else: ?>
        <h1>✓ Payment Successful!</h1>
        <p>Thank you for your payment. Your transaction has been completed successfully.</p>
    <?php endif; ?>

    <?php if ($order_id): ?>
        <div class="order-details">
            <p><strong>Order ID:</strong> <code><?php echo esc_html($order_id); ?></code></p>
            <p><small>Please save this Order ID for your records.</small></p>
        </div>
    <?php endif; ?>

    <p>You will receive a confirmation email with your order details.</p>

    <a href="<?php echo home_url(); ?>" class="btn">Return to Home</a>
</div>

<?php get_footer(); ?>
```

### 3. Create Payment Failed Page

**Page Title:** Payment Failed
**Slug:** `payment-failed`

**File:** `wp-content/themes/your-theme/page-payment-failed.php`

```php
<?php
/**
 * Template Name: Payment Failed
 * Description: Display payment failure message
 */

get_header();

$order_id = isset($_GET['order_id']) ? sanitize_text_field($_GET['order_id']) : '';
$reason = isset($_GET['reason']) ? sanitize_text_field($_GET['reason']) : 'Unknown error occurred';
?>

<div class="payment-failed-container">
    <h1>✗ Payment Failed</h1>
    <p>Unfortunately, your payment could not be processed.</p>

    <?php if ($order_id): ?>
        <div class="order-details">
            <p><strong>Order ID:</strong> <code><?php echo esc_html($order_id); ?></code></p>
        </div>
    <?php endif; ?>

    <div class="failure-reason">
        <p><strong>Reason:</strong> <?php echo esc_html($reason); ?></p>
    </div>

    <p>Please try again or contact our support team if the problem persists.</p>

    <div class="action-buttons">
        <a href="javascript:history.back()" class="btn">Try Again</a>
        <a href="<?php echo home_url('/contact'); ?>" class="btn btn-secondary">Contact Support</a>
    </div>
</div>

<?php get_footer(); ?>
```

---

## Shortcodes & Usage

### Single Payment Button

```
[razorpay_button amount="1500" type="EVENT" event_id="EVENT123" text="Register for Event - ₹1500"]
```

**Parameters:**
- `amount` - Amount in INR (required)
- `type` - Payment type: EVENT, SESSION, PRODUCT, OTHER (required)
- `event_id` - Event ID from your backend (optional)
- `session_id` - Session ID from your backend (optional)
- `text` - Button text (default: "Pay Now")
- `class` - Additional CSS classes (optional)

### Payment Form with Customer Details

```
[razorpay_form amount="2500" type="EVENT" event_id="EVENT456" button_text="Proceed to Payment"]
```

### Club/Combo Purchase Form

```
[razorpay_club_form amount="4500" type="EVENT" event_id="EVENT789" customer_count="3" button_text="Pay for Group"]
```

**Parameters:**
- `customer_count` - Number of customers (default: 3)

### Usage in PHP Templates

```php
// In your theme template files
<?php
echo do_shortcode('[razorpay_button amount="1500" type="EVENT" event_id="' . $event_id . '"]');
?>
```

### Dynamic Payment Button

```php
<?php
// Get event details from your database
$event_id = 'EVENT123';
$event_price = 1500;
$event_name = 'Tech Conference 2025';

echo do_shortcode('[razorpay_button
    amount="' . $event_price . '"
    type="EVENT"
    event_id="' . $event_id . '"
    text="Register for ' . $event_name . ' - ₹' . $event_price . '"]');
?>
```

---

## Testing Guide

### 1. Test Environment Setup

**Backend (Test Mode):**
```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

### 2. Test Cards

Use these Razorpay test cards:

**Success:**
- Card Number: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date

**Failure:**
- Card Number: `4000 0000 0000 0002`
- CVV: Any 3 digits
- Expiry: Any future date

### 3. Test Scenarios

**Scenario 1: Single Payment**
1. Add shortcode to a page: `[razorpay_button amount="100" type="EVENT"]`
2. Click "Pay Now"
3. Complete payment on Razorpay
4. Verify redirect to success page

**Scenario 2: Form Payment**
1. Add form shortcode: `[razorpay_form amount="200" type="EVENT"]`
2. Fill customer details
3. Submit form
4. Complete payment
5. Verify customer details in backend database

**Scenario 3: Club/Combo Purchase**
1. Add club form: `[razorpay_club_form amount="600" type="EVENT" customer_count="3"]`
2. Fill details for 3 customers
3. Complete payment
4. Verify all customer details in backend

**Scenario 4: Payment Failure**
1. Use failure test card
2. Verify redirect to failure page
3. Check error message

**Scenario 5: Webhook Verification**
1. Make a successful payment
2. Check backend logs for webhook events
3. Verify payment status in database

### 4. Debugging

**Enable WordPress Debug Mode:**

```php
// wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

**Check Logs:**
- WordPress: `wp-content/debug.log`
- Backend: Console logs in terminal

**Browser Console:**
- Open Developer Tools (F12)
- Check Console tab for JavaScript errors
- Check Network tab for API requests

---

## Security Checklist

### Backend Security

✅ **CORS Configuration**
- Add WordPress domain to allowed origins
- Verify credentials are not exposed in responses

✅ **Webhook Signature Verification**
- Already implemented in `razorpay.webhook.js:109`
- Uses HMAC-SHA256 with secret key

✅ **HTTPS Required**
- Backend must use HTTPS
- Razorpay webhooks require HTTPS

✅ **Environment Variables**
- Never commit `.env` file
- Use different keys for test/production

### WordPress Security

✅ **Nonce Verification**
- Already implemented in AJAX handlers
- Prevents CSRF attacks

✅ **Input Sanitization**
- All inputs sanitized with `sanitize_text_field()`, `sanitize_email()`
- Prevents XSS and injection attacks

✅ **Output Escaping**
- All outputs escaped with `esc_html()`, `esc_attr()`

✅ **Rate Limiting**
- Consider adding rate limiting for AJAX endpoints
- Use WordPress plugins like "WP Limit Login Attempts"

✅ **SSL Certificate**
- WordPress must use HTTPS
- Payment pages require secure connection

### General Security

✅ **API Key Protection**
- Never expose `RAZORPAY_KEY_SECRET` to frontend
- Only send `RAZORPAY_KEY_ID` if needed

✅ **Payment Link Expiration**
- Razorpay payment links expire after 15 minutes by default

✅ **Database Security**
- Use prepared statements (handled by WordPress)
- Never store sensitive card data

---

## Troubleshooting

### Common Issues

#### 1. CORS Error

**Error:** "Access to XMLHttpRequest has been blocked by CORS policy"

**Solution:**
```javascript
// In backend server.js
app.use(cors({
  origin: 'https://your-wordpress-site.com',
  credentials: true
}));
```

#### 2. Webhook Not Working

**Error:** Webhooks not received by backend

**Solution:**
- Verify webhook URL is publicly accessible
- Check Razorpay Dashboard webhook logs
- Verify `RAZORPAY_KEY_SECRET` matches webhook secret
- Check backend logs for errors

**Test Webhook:**
```bash
curl -X POST https://your-backend.com/api/web/razorpay/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: test_signature" \
  -d '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"test"}}}}'
```

#### 3. Payment Status Not Updating

**Error:** Long polling times out, status stays PENDING

**Solution:**
- Check if webhook is being received
- Verify backend database connection
- Check backend logs for errors in webhook handler
- Test manually: `GET /api/web/razorpay/status/:orderId`

#### 4. JavaScript Not Loading

**Error:** "razorpayConfig is not defined"

**Solution:**
- Verify script is enqueued in `functions.php`
- Check browser console for 404 errors
- Clear WordPress cache
- Check file path in `wp_enqueue_script()`

#### 5. Form Submission Not Working

**Error:** AJAX request fails with 400/500 error

**Solution:**
- Check nonce verification
- Verify all required fields are sent
- Check backend API logs
- Enable WordPress debug mode

#### 6. Callback Page Not Working

**Error:** User not redirected after payment

**Solution:**
- Verify callback URL in backend matches WordPress page
- Check if `localStorage` is enabled
- Test callback manually: Navigate to `/payment-callback/`

### Debug Commands

**Test Backend API:**
```bash
# Test create order
curl -X POST https://your-backend.com/api/web/razorpay/create-order \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"type":"EVENT","metadata":{}}'

# Test get status
curl https://your-backend.com/api/web/razorpay/status/order_MhXXXXXXXXXX
```

**Check WordPress AJAX:**
```javascript
// In browser console
jQuery.post(razorpayConfig.ajaxUrl, {
  action: 'razorpay_create_order',
  nonce: razorpayConfig.nonce,
  amount: 100,
  type: 'EVENT'
}).done(console.log).fail(console.error);
```

---

## Advanced Features

### 1. Custom Metadata

Add custom fields to payment:

```php
// In your template
$metadata = array(
    'userId' => get_current_user_id(),
    'eventName' => 'Tech Conference 2025',
    'ticketType' => 'VIP',
    'seatNumber' => 'A12'
);

echo do_shortcode('[razorpay_button
    amount="5000"
    type="EVENT"
    metadata="' . esc_attr(json_encode($metadata)) . '"]');
```

### 2. WooCommerce Integration

Sync with WooCommerce orders:

```php
// Add to functions.php
add_action('woocommerce_thankyou', 'sync_woocommerce_payment', 10, 1);

function sync_woocommerce_payment($order_id) {
    $order = wc_get_order($order_id);

    // Create Razorpay payment
    $result = razorpay_create_order(
        $order->get_total(),
        'PRODUCT',
        null,
        null,
        array(
            'woocommerceOrderId' => $order_id,
            'callbackUrl' => $order->get_checkout_order_received_url()
        )
    );

    if ($result['success']) {
        $order->update_meta_data('_razorpay_order_id', $result['data']['orderId']);
        $order->save();
    }
}
```

### 3. Email Notifications

Send custom emails after payment:

```php
// Add to functions.php
add_action('razorpay_payment_success', 'send_payment_confirmation_email', 10, 1);

function send_payment_confirmation_email($payment_data) {
    $to = $payment_data['customerEmail'];
    $subject = 'Payment Confirmation - Order #' . $payment_data['orderId'];
    $message = 'Thank you for your payment...';

    wp_mail($to, $subject, $message);
}
```

### 4. User Dashboard

Show payment history:

```php
// Create custom page template
// File: page-payment-history.php

<?php
get_header();

if (!is_user_logged_in()) {
    wp_redirect(wp_login_url());
    exit;
}

// Get user payments from backend
$user_id = get_current_user_id();
// Call backend API to fetch user payment history
?>

<div class="payment-history">
    <h1>My Payment History</h1>
    <!-- Display payment history table -->
</div>

<?php get_footer(); ?>
```

### 5. Discount Coupons

Apply coupons before payment:

```php
// Add coupon field to form
add_shortcode('razorpay_form_with_coupon', 'razorpay_form_with_coupon_shortcode');

function razorpay_form_with_coupon_shortcode($atts) {
    // Form with coupon field
    // AJAX to verify coupon with backend
    // Apply discount and create order
}
```

---

## Production Checklist

Before going live:

- [ ] Switch to Razorpay live keys
- [ ] Update webhook URL to production backend
- [ ] Enable SSL/HTTPS on WordPress and backend
- [ ] Test complete payment flow
- [ ] Test webhook delivery
- [ ] Set up error monitoring
- [ ] Configure backup/disaster recovery
- [ ] Test mobile responsiveness
- [ ] Set up Google Analytics events
- [ ] Configure email notifications
- [ ] Update privacy policy with payment info
- [ ] Test refund flow
- [ ] Document support process

---

## Support & Resources

### Documentation
- [Razorpay API Docs](https://razorpay.com/docs/api/)
- [Razorpay Payment Links](https://razorpay.com/docs/payment-links/)
- [Razorpay Webhooks](https://razorpay.com/docs/webhooks/)
- [WordPress AJAX](https://codex.wordpress.org/AJAX_in_Plugins)

### Your Backend Endpoints
- `POST /api/web/razorpay/create-order` - Create payment order
- `GET /api/web/razorpay/status/:orderId` - Get payment status
- `POST /api/web/razorpay/webhook` - Receive Razorpay webhooks

### Contact
For issues with this integration, check:
1. WordPress debug log: `wp-content/debug.log`
2. Backend server logs
3. Browser console (F12)
4. Razorpay Dashboard webhook logs

---

## Version History

**v1.0.0** - Initial implementation
- Basic payment button
- Payment forms
- Club/combo purchases
- Long polling status check
- Webhook integration
- Success/failure pages

---

## License

This integration code is provided as-is for use with your Razorpay backend implementation.

---

**End of Integration Guide**
