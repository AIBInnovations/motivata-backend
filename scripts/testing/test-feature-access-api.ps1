# Feature Access API Testing Script (PowerShell)
# Tests the /api/web/feature-access/check endpoint
# Usage: .\test-feature-access-api.ps1 [BaseUrl]

param(
    [string]$BaseUrl = "http://localhost:5000",
    [string]$TestPhone = "+919179621765"
)

$ApiEndpoint = "$BaseUrl/api/web/feature-access/check"

# Print separator
function Print-Separator {
    Write-Host ""
    Write-Host ("=" * 80)
    Write-Host ""
}

# Test API endpoint
function Test-FeatureAccess {
    param(
        [string]$Feature,
        [string]$Phone,
        [string]$Description
    )

    Write-Host "Testing: $Description" -ForegroundColor Cyan
    Write-Host "Feature: $Feature"
    Write-Host "Phone: $Phone"
    Write-Host ""

    $body = @{
        featureKey = $Feature
        phone = $Phone
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $ApiEndpoint -Method Post -Body $body -ContentType "application/json"

        Write-Host "Response:" -ForegroundColor Blue
        $response | ConvertTo-Json -Depth 5
        Write-Host ""

        if ($response.success -eq $true) {
            $hasAccess = $response.data.hasAccess
            $reason = $response.data.reason

            if ($hasAccess -eq $true) {
                Write-Host "✅ Access Granted - Reason: $reason" -ForegroundColor Green
            } else {
                Write-Host "⛔ Access Denied - Reason: $reason" -ForegroundColor Yellow
            }

            # Show membership details if present
            if ($response.data.membership) {
                Write-Host ""
                Write-Host "Membership Details:" -ForegroundColor Blue
                Write-Host "  Plan: $($response.data.membership.planName)"
                Write-Host "  End Date: $($response.data.membership.endDate)"
                Write-Host "  Days Remaining: $($response.data.membership.daysRemaining)"
            }
        } else {
            Write-Host "❌ API Request Failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

# Start testing
Print-Separator
Write-Host "FEATURE ACCESS API TESTING" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "Endpoint: $ApiEndpoint"
Print-Separator

# Test 1: Check SOS feature access
Test-FeatureAccess -Feature "SOS" -Phone $TestPhone -Description "SOS Feature Access Check"
Print-Separator

# Test 2: Check CONNECT feature access
Test-FeatureAccess -Feature "CONNECT" -Phone $TestPhone -Description "Connect Feature Access Check"
Print-Separator

# Test 3: Check CHALLENGE feature access
Test-FeatureAccess -Feature "CHALLENGE" -Phone $TestPhone -Description "Challenge Feature Access Check"
Print-Separator

# Test 4: Test with different phone format (10 digits)
Test-FeatureAccess -Feature "SOS" -Phone "9179621765" -Description "SOS Feature Access Check (10-digit phone)"
Print-Separator

# Test 5: Invalid feature key (should fail validation)
Write-Host "Testing: Invalid Feature Key (Should Fail)" -ForegroundColor Cyan
Write-Host "Feature: INVALID"
Write-Host "Phone: $TestPhone"
Write-Host ""

$invalidBody = @{
    featureKey = "INVALID"
    phone = $TestPhone
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $ApiEndpoint -Method Post -Body $invalidBody -ContentType "application/json" -ErrorAction Stop

    Write-Host "Response:" -ForegroundColor Blue
    $response | ConvertTo-Json -Depth 5
    Write-Host ""

    if ($response.success -eq $false) {
        Write-Host "✅ Validation working correctly (rejected invalid feature key)" -ForegroundColor Green
    } else {
        Write-Host "❌ Validation failed (accepted invalid feature key)" -ForegroundColor Red
    }
} catch {
    # A 400 error is expected for validation failure
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Validation working correctly (rejected invalid feature key with 400 error)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected error: $_" -ForegroundColor Red
    }
}

Print-Separator

Write-Host "Testing Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Notes:"
Write-Host "  - Change -TestPhone parameter to test with different phone numbers"
Write-Host "  - Use admin endpoints to toggle feature settings between tests"
Write-Host "  - Example: .\test-feature-access-api.ps1 -BaseUrl 'http://localhost:5000' -TestPhone '+919999999999'"
Write-Host ""
