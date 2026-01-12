#!/bin/bash

# Quick script to restore the deleted membership plan
# Replace YOUR_ADMIN_TOKEN with an actual admin bearer token

curl -X POST \
  http://localhost:5000/api/admin/membership-plans/695be44869cdb8c106f6bff6/restore \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo "If successful, the plan should now be restored."
echo "Verify by checking the admin panel or running:"
echo "curl -X GET http://localhost:5000/api/admin/membership-plans/695be44869cdb8c106f6bff6 -H \"Authorization: Bearer YOUR_ADMIN_TOKEN\""
