/**
 * Debug script to decode and verify JWT tokens
 * Usage: node debug-token.js <your-access-token>
 */

import jwt from 'jsonwebtoken';

const token = process.argv[2];

if (!token) {
  console.log('Usage: node debug-token.js <your-token>');
  process.exit(1);
}

console.log('\n=== Token Debugging ===\n');

// Decode without verification (to see payload)
const decoded = jwt.decode(token);
console.log('Decoded Token Payload:');
console.log(JSON.stringify(decoded, null, 2));

// Check expiration
if (decoded && decoded.exp) {
  const expirationDate = new Date(decoded.exp * 1000);
  const now = new Date();
  const isExpired = now > expirationDate;

  console.log('\n=== Expiration Info ===');
  console.log('Expires at:', expirationDate.toISOString());
  console.log('Current time:', now.toISOString());
  console.log('Is expired:', isExpired);

  if (isExpired) {
    console.log('\n⚠️  TOKEN IS EXPIRED! Please refresh your token or login again.');
  } else {
    console.log('\n✓ Token is still valid');
  }
}

// Check required fields for Super Admin
console.log('\n=== Super Admin Check ===');
console.log('userType:', decoded?.userType, decoded?.userType === 'admin' ? '✓' : '✗');
console.log('role:', decoded?.role, decoded?.role === 'SUPER_ADMIN' ? '✓' : '✗');

if (decoded?.userType === 'admin' && decoded?.role === 'SUPER_ADMIN') {
  console.log('\n✓ Token has correct Super Admin credentials');
} else {
  console.log('\n✗ Token is missing required Super Admin credentials');
}
