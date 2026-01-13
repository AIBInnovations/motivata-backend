#!/bin/bash

# Feature Access API Testing Script
# Tests the /api/web/feature-access/check endpoint
# Usage: ./test-feature-access-api.sh [BASE_URL]

# Configuration
BASE_URL="${1:-http://localhost:5000}"
API_ENDPOINT="${BASE_URL}/api/web/feature-access/check"
TEST_PHONE="+919179621765"  # Change to a real test phone number

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print separator
print_separator() {
    echo ""
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo ""
}

# Test API endpoint
test_feature_access() {
    local feature=$1
    local phone=$2
    local description=$3

    echo -e "${CYAN}Testing: ${description}${NC}"
    echo "Feature: ${feature}"
    echo "Phone: ${phone}"
    echo ""

    local response=$(curl -s -X POST "${API_ENDPOINT}" \
        -H "Content-Type: application/json" \
        -d "{\"featureKey\":\"${feature}\",\"phone\":\"${phone}\"}")

    echo -e "${BLUE}Response:${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""

    # Check if request was successful
    local success=$(echo "$response" | jq -r '.success' 2>/dev/null)
    if [ "$success" == "true" ]; then
        local hasAccess=$(echo "$response" | jq -r '.data.hasAccess' 2>/dev/null)
        local reason=$(echo "$response" | jq -r '.data.reason' 2>/dev/null)

        if [ "$hasAccess" == "true" ]; then
            echo -e "${GREEN}✅ Access Granted - Reason: ${reason}${NC}"
        else
            echo -e "${YELLOW}⛔ Access Denied - Reason: ${reason}${NC}"
        fi
    else
        echo -e "${RED}❌ API Request Failed${NC}"
    fi
}

# Start testing
print_separator
echo -e "${CYAN}FEATURE ACCESS API TESTING${NC}"
echo "Base URL: ${BASE_URL}"
echo "Endpoint: ${API_ENDPOINT}"
print_separator

# Test 1: Check SOS feature access
test_feature_access "SOS" "${TEST_PHONE}" "SOS Feature Access Check"
print_separator

# Test 2: Check CONNECT feature access
test_feature_access "CONNECT" "${TEST_PHONE}" "Connect Feature Access Check"
print_separator

# Test 3: Check CHALLENGE feature access
test_feature_access "CHALLENGE" "${TEST_PHONE}" "Challenge Feature Access Check"
print_separator

# Test 4: Test with different phone format
test_feature_access "SOS" "9179621765" "SOS Feature Access Check (10-digit phone)"
print_separator

# Test 5: Invalid feature key (should fail validation)
echo -e "${CYAN}Testing: Invalid Feature Key (Should Fail)${NC}"
echo "Feature: INVALID"
echo "Phone: ${TEST_PHONE}"
echo ""

response=$(curl -s -X POST "${API_ENDPOINT}" \
    -H "Content-Type: application/json" \
    -d "{\"featureKey\":\"INVALID\",\"phone\":\"${TEST_PHONE}\"}")

echo -e "${BLUE}Response:${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo ""

success=$(echo "$response" | jq -r '.success' 2>/dev/null)
if [ "$success" == "false" ]; then
    echo -e "${GREEN}✅ Validation working correctly (rejected invalid feature key)${NC}"
else
    echo -e "${RED}❌ Validation failed (accepted invalid feature key)${NC}"
fi

print_separator

echo -e "${GREEN}Testing Complete!${NC}"
echo ""
echo "Notes:"
echo "  - If you get 'command not found: jq', install jq for pretty JSON output"
echo "  - Change TEST_PHONE in script to test with different phone numbers"
echo "  - Use admin endpoints to toggle feature settings between tests"
echo ""
