# PowerShell script to test Club Post Management APIs

$baseUrl = "http://localhost:5000"
$clubId = "695be8ec69cdb8c106f6c088"  # Yoga Club
$postId = "69614e20ea37416dfe879227"   # First post in Yoga Club

Write-Host "======================================================================"
Write-Host "Club Post Management API Tests"
Write-Host "======================================================================"
Write-Host ""

# Step 1: Login as Admin
Write-Host "1. Logging in as admin..."
Write-Host "----------------------------------------------------------------------"
$loginBody = @{
    username = "synquic_motivata"
    password = "12345678"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/web/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.data.tokens.accessToken
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "Access Token: $($token.Substring(0, 50))..." -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Step 2: Test GET /api/web/clubs/:clubId/posts
Write-Host "2. Testing GET /api/web/clubs/$clubId/posts"
Write-Host "----------------------------------------------------------------------"
try {
    $postsResponse = Invoke-RestMethod -Uri "$baseUrl/api/web/clubs/$clubId/posts?page=1&limit=10" -Method GET -Headers $headers
    Write-Host "✅ Get club posts successful!" -ForegroundColor Green
    Write-Host "Club: $($postsResponse.data.club.name)" -ForegroundColor Cyan
    Write-Host "Total posts: $($postsResponse.data.pagination.totalCount)" -ForegroundColor Cyan
    Write-Host "Posts returned: $($postsResponse.data.posts.Count)" -ForegroundColor Cyan

    if ($postsResponse.data.posts.Count -gt 0) {
        Write-Host ""
        Write-Host "First post details:" -ForegroundColor Yellow
        $firstPost = $postsResponse.data.posts[0]
        Write-Host "  Post ID: $($firstPost.id)" -ForegroundColor Gray
        Write-Host "  Author: $($firstPost.author.name) ($($firstPost.author.type))" -ForegroundColor Gray
        Write-Host "  Likes: $($firstPost.likeCount), Comments: $($firstPost.commentCount)" -ForegroundColor Gray
        Write-Host "  Created: $($firstPost.createdAt)" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "❌ Get club posts failed: $_" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Step 3: Test GET /api/web/clubs/:clubId/posts with filters
Write-Host "3. Testing GET /api/web/clubs/$clubId/posts with filters (includeDeleted=true)"
Write-Host "----------------------------------------------------------------------"
try {
    $filteredResponse = Invoke-RestMethod -Uri "$baseUrl/api/web/clubs/$clubId/posts?includeDeleted=true&sortBy=createdAt&sortOrder=desc" -Method GET -Headers $headers
    Write-Host "✅ Get club posts with filters successful!" -ForegroundColor Green
    Write-Host "Total posts (including deleted): $($filteredResponse.data.pagination.totalCount)" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ Get club posts with filters failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Step 4: Test GET /api/web/clubs/posts/:postId
Write-Host "4. Testing GET /api/web/clubs/posts/$postId"
Write-Host "----------------------------------------------------------------------"
try {
    $postDetailResponse = Invoke-RestMethod -Uri "$baseUrl/api/web/clubs/posts/$postId" -Method GET -Headers $headers
    Write-Host "✅ Get post by ID successful!" -ForegroundColor Green
    $post = $postDetailResponse.data.post
    Write-Host "Post ID: $($post.id)" -ForegroundColor Cyan
    Write-Host "Club: $($post.club.name)" -ForegroundColor Cyan
    Write-Host "Author: $($post.author.name) ($($post.author.type))" -ForegroundColor Cyan
    Write-Host "Likes: $($post.likeCount), Comments: $($post.commentCount)" -ForegroundColor Cyan
    Write-Host "Media items: $($post.media.Count)" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ Get post by ID failed: $_" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Step 5: Test DELETE /api/web/clubs/posts/:postId (create a test post first if needed)
Write-Host "5. Testing DELETE /api/web/clubs/posts/$postId"
Write-Host "----------------------------------------------------------------------"
Write-Host "⚠️  WARNING: This will soft-delete post $postId" -ForegroundColor Yellow
Write-Host "Do you want to proceed? (y/n): " -NoNewline
$confirmation = Read-Host

if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
    try {
        $deleteResponse = Invoke-RestMethod -Uri "$baseUrl/api/web/clubs/posts/$postId" -Method DELETE -Headers $headers
        Write-Host "✅ Delete post successful!" -ForegroundColor Green
        Write-Host "Deleted post ID: $($deleteResponse.data.postId)" -ForegroundColor Cyan
        Write-Host "Deleted at: $($deleteResponse.data.deletedAt)" -ForegroundColor Cyan
        Write-Host ""

        # Verify deletion by trying to get the post with includeDeleted=false
        Write-Host "6. Verifying deletion (should return 404)..."
        Write-Host "----------------------------------------------------------------------"
        try {
            $verifyResponse = Invoke-RestMethod -Uri "$baseUrl/api/web/clubs/posts/$postId" -Method GET -Headers $headers
            Write-Host "❌ Post still accessible (should be deleted)" -ForegroundColor Red
        } catch {
            if ($_.Exception.Response.StatusCode -eq 404) {
                Write-Host "✅ Post correctly returns 404 when includeDeleted=false" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Unexpected error: $_" -ForegroundColor Yellow
            }
        }
        Write-Host ""

        # Try to get the post with includeDeleted=true
        Write-Host "7. Getting deleted post with includeDeleted=true..."
        Write-Host "----------------------------------------------------------------------"
        try {
            $deletedResponse = Invoke-RestMethod -Uri "$baseUrl/api/web/clubs/posts/$postId`?includeDeleted=true" -Method GET -Headers $headers
            Write-Host "✅ Deleted post retrieved successfully" -ForegroundColor Green
            Write-Host "Is Deleted: $($deletedResponse.data.post.isDeleted)" -ForegroundColor Cyan
            Write-Host "Deleted At: $($deletedResponse.data.post.deletedAt)" -ForegroundColor Cyan
        } catch {
            Write-Host "❌ Failed to retrieve deleted post: $_" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Delete post failed: $_" -ForegroundColor Red
        Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Delete test skipped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================================"
Write-Host "API Tests Complete"
Write-Host "======================================================================"
