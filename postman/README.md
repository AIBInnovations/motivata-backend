# Razorpay API Postman Collection

This directory contains Postman collection and environment files for testing the Razorpay payment integration.

## Files

- `Razorpay_API.postman_collection.json` - Main collection with all API endpoints
- `Razorpay_Environment.postman_environment.json` - Environment variables for easy configuration

## Import into Postman

1. Open Postman
2. Click **Import** button in the top left
3. Drag and drop both JSON files or click **Upload Files**
4. Select both files:
   - `Razorpay_API.postman_collection.json`
   - `Razorpay_Environment.postman_environment.json`

## Setup

### Configure Environment Variables

After importing, select the **Razorpay API Environment** from the environment dropdown and update these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `baseUrl` | Your backend server URL | `http://localhost:5000` |
| `eventId` | Valid MongoDB ObjectId for an event | `507f1f77bcf86cd799439011` |
| `sessionId` | Valid MongoDB ObjectId for a session | `507f1f77bcf86cd799439012` |
| `authToken` | JWT token for authenticated requests (optional) | `eyJhbGciOiJIUzI1NiIs...` |
| `webhookSignature` | Test signature for webhook testing | `test_signature_123` |

**Note:** `orderId` and `paymentUrl` are automatically set by the test scripts after creating an order.

## Available Requests

### 1. Create Order - Single Customer
Creates a payment order for a single customer.

**Request Body:**
```json
{
  "amount": 1500,
  "currency": "INR",
  "type": "EVENT",
  "eventId": "{{eventId}}",
  "metadata": {
    "callbackUrl": "{{baseUrl}}/payment/callback",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "+919876543210"
  }
}
```

### 2. Create Order - Club/Combo (Multiple Customers)
Creates a payment order for multiple customers (club/combo purchase).

**Request Body:**
```json
{
  "amount": 4500,
  "currency": "INR",
  "type": "EVENT",
  "eventId": "{{eventId}}",
  "metadata": {
    "callbackUrl": "{{baseUrl}}/payment/callback",
    "customers": [
      {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+919876543210"
      },
      {
        "name": "Jane Smith",
        "email": "jane@example.com",
        "phone": "+919876543211"
      },
      {
        "name": "Bob Johnson",
        "email": "bob@example.com",
        "phone": "+919876543212"
      }
    ]
  }
}
```

**Features:**
- SMS/Email notifications are disabled
- All customer details are logged in the console
- Customer details are stored in Razorpay `notes` and payment metadata

### 3. Create Order - Session Payment
Creates a payment order for a session.

### 4. Get Payment Status
Retrieves the current payment status by order ID.

**Usage:**
1. Run "Create Order" request first
2. The `orderId` is automatically saved to environment variables
3. Run this request to check payment status
4. Use for long polling to track payment completion

### 5. Webhook Requests
Simulate Razorpay webhook events:

- **Payment Captured** - Payment successfully completed
- **Payment Failed** - Payment failed with error
- **Order Paid** - Order marked as paid
- **Payment Link Paid** - Payment link completed
- **Payment Link Cancelled** - User cancelled payment
- **Refund Processed** - Refund completed

**Note:** Webhook requests require valid signature verification. For testing locally, you may need to temporarily disable signature verification or use the actual webhook secret from your `.env` file.

## Testing Workflow

### Basic Flow:
1. **Create Order** (Single or Club/Combo)
   - Check response for `orderId` and `paymentUrl`
   - Order ID is auto-saved to environment

2. **Check Payment Status**
   - Polls the payment status
   - Initially shows `PENDING`
   - After payment, shows `SUCCESS`, `FAILED`, or `REFUNDED`

3. **Simulate Webhook** (optional for local testing)
   - Use webhook requests to simulate Razorpay events
   - Update `orderId` in webhook payload to match your order

### Club/Combo Purchase Testing:
1. Run **Create Order - Club/Combo** request
2. Check console logs for customer information:
   ```
   === Club/Combo Purchase - Multiple Customers ===
   Number of customers: 3
   Customer 1: { name: 'John Doe', email: 'john@example.com', phone: '+919876543210' }
   Customer 2: { name: 'Jane Smith', email: 'jane@example.com', phone: '+919876543211' }
   Customer 3: { name: 'Bob Johnson', email: 'bob@example.com', phone: '+919876543212' }
   ```
3. Payment URL opens Razorpay payment page (no SMS/email sent)
4. After payment, webhook logs customer details again

## Tips

- **Auto-complete:** The collection uses test scripts to automatically save `orderId` and `paymentUrl` after creating orders
- **Console Output:** Open Postman Console (View > Show Postman Console) to see test script output
- **Authentication:** Enable the `Authorization` header if you're testing with authenticated users
- **Long Polling:** You can repeatedly run "Get Payment Status" every few seconds to simulate long polling

## Troubleshooting

### 400 Bad Request
- Verify `eventId` or `sessionId` exists in your database
- Check request body format matches examples

### 404 Not Found
- Verify `baseUrl` is correct
- Ensure backend server is running
- Check that routes are properly registered

### 401 Unauthorized (Webhooks)
- Webhook signature verification may be failing
- For local testing, you may need to use the actual secret from `.env`
- Or temporarily disable signature verification for testing

### 500 Internal Server Error
- Check backend console logs for detailed error messages
- Verify Razorpay credentials are configured in `.env`
- Ensure MongoDB connection is active

## Environment Variables Required in Backend

Make sure your `.env` file has:
```env
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
FRONTEND_URL=http://localhost:3000
```
