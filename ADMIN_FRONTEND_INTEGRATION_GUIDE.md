# Admin Frontend Integration Guide

## Club Post Management APIs

### 📋 Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Authentication](#authentication)
4. [Implementation Examples](#implementation-examples)
5. [UI/UX Recommendations](#uiux-recommendations)
6. [Complete Component Example](#complete-component-example)
7. [Error Handling](#error-handling)
8. [Testing Checklist](#testing-checklist)

---

## Overview

Three new endpoints have been added to manage club posts from the admin panel:

| Endpoint                         | Method | Purpose                  |
| -------------------------------- | ------ | ------------------------ |
| `/api/web/clubs/:clubId/posts` | GET    | List all posts in a club |
| `/api/web/clubs/posts/:postId` | GET    | Get single post details  |
| `/api/web/clubs/posts/:postId` | DELETE | Soft delete a post       |

**Key Features:**

- 🔒 Admin authentication required
- 🗑️ Soft delete (posts can be recovered)
- 👁️ View deleted posts with `includeDeleted` flag
- 🎯 Multiple filters (media type, author type, deleted status)
- 📄 Pagination support
- 🔢 Automatic club postCount updates

---

## API Endpoints

### 1. GET /api/web/clubs/:clubId/posts

**Purpose**: Fetch all posts in a specific club with filtering and pagination

#### Request

```http
GET /api/web/clubs/:clubId/posts?page=1&limit=20&includeDeleted=false&sortBy=createdAt&sortOrder=desc
Authorization: Bearer {adminToken}
```

#### Query Parameters

| Parameter          | Type    | Default   | Required | Description                                               |
| ------------------ | ------- | --------- | -------- | --------------------------------------------------------- |
| `page`           | number  | 1         | No       | Page number (min: 1)                                      |
| `limit`          | number  | 20        | No       | Items per page (1-100)                                    |
| `sortBy`         | string  | createdAt | No       | Sort field:`createdAt`, `likeCount`, `commentCount` |
| `sortOrder`      | string  | desc      | No       | Sort order:`asc` or `desc`                            |
| `includeDeleted` | boolean | false     | No       | Include soft-deleted posts                                |
| `mediaType`      | string  | -         | No       | Filter by media:`image`, `video`, `all`             |
| `authorType`     | string  | -         | No       | Filter by author:`User`, `Admin`                      |

#### Response (200 OK)

```json
{
  "status": 200,
  "message": "Club posts fetched successfully",
  "error": null,
  "data": {
    "club": {
      "id": "695be8ec69cdb8c106f6c088",
      "name": "Yoga Club",
      "memberCount": 0,
      "postCount": 4
    },
    "posts": [
      {
        "id": "69614e20ea37416dfe879227",
        "content": "Post content or caption",
        "media": [
          {
            "url": "https://...",
            "type": "image",
            "thumbnail": "https://..."
          }
        ],
        "author": {
          "id": "692b31373642a00a67dc2f43",
          "name": "John Doe",
          "email": "john@example.com",
          "type": "User"
        },
        "club": {
          "id": "695be8ec69cdb8c106f6c088",
          "name": "Yoga Club",
          "thumbnail": "https://..."
        },
        "likeCount": 15,
        "commentCount": 3,
        "shareCount": 2,
        "isDeleted": false,        // Only if includeDeleted=true
        "deletedAt": null,         // Only if includeDeleted=true
        "createdAt": "2026-01-09T18:51:12.489Z",
        "updatedAt": "2026-01-09T18:51:12.489Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCount": 45,
      "limit": 20,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### 2. GET /api/web/clubs/posts/:postId

**Purpose**: Get detailed information about a specific post

#### Request

```http
GET /api/web/clubs/posts/:postId?includeDeleted=false
Authorization: Bearer {adminToken}
```

#### Query Parameters

| Parameter          | Type    | Default | Required | Description               |
| ------------------ | ------- | ------- | -------- | ------------------------- |
| `includeDeleted` | boolean | false   | No       | Show deleted post details |

#### Response (200 OK)

```json
{
  "status": 200,
  "message": "Post fetched successfully",
  "error": null,
  "data": {
    "post": {
      "id": "69614e20ea37416dfe879227",
      "content": "Post content or caption",
      "media": [
        {
          "url": "https://cloudinary.com/...",
          "type": "image",
          "thumbnail": "https://..."
        }
      ],
      "author": {
        "id": "692b31373642a00a67dc2f43",
        "name": "John Doe",
        "email": "john@example.com",
        "type": "User"
      },
      "club": {
        "id": "695be8ec69cdb8c106f6c088",
        "name": "Yoga Club",
        "thumbnail": "https://..."
      },
      "likeCount": 15,
      "commentCount": 3,
      "shareCount": 2,
      "isDeleted": false,        // Only if includeDeleted=true
      "deletedAt": null,         // Only if includeDeleted=true
      "createdAt": "2026-01-09T18:51:12.489Z",
      "updatedAt": "2026-01-09T18:51:12.489Z"
    }
  }
}
```

#### Response (404 Not Found) - When post is deleted and includeDeleted=false

```json
{
  "status": 404,
  "message": "Post not found",
  "error": "Post not found",
  "data": null
}
```

---

### 3. DELETE /api/web/clubs/posts/:postId

**Purpose**: Soft delete a post (can be recovered)

#### Request

```http
DELETE /api/web/clubs/posts/:postId
Authorization: Bearer {adminToken}
```

#### Response (200 OK)

```json
{
  "status": 200,
  "message": "Post deleted successfully",
  "error": null,
  "data": {
    "postId": "69614a53ffa931d70f9409c0",
    "clubId": "695be8ec69cdb8c106f6c088",
    "deletedAt": "2026-02-04T14:23:16.268Z"
  }
}
```

#### Response (409 Conflict) - Post already deleted

```json
{
  "status": 409,
  "message": "Post is already deleted",
  "error": "Post is already deleted",
  "data": null
}
```

---

## Authentication

All endpoints require admin authentication via Bearer token:

```javascript
headers: {
  'Authorization': `Bearer ${adminToken}`,
  'Content-Type': 'application/json'
}
```

**Getting Admin Token:**

```javascript
// Login endpoint
POST /api/web/auth/login
Body: {
  "username": "admin_username",
  "password": "admin_password"
}

// Response
{
  "data": {
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

---

## Implementation Examples

### React + Axios Example

#### 1. API Service Setup

```javascript
// services/clubPostApi.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance with admin auth
const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Club Post API functions
export const clubPostApi = {
  /**
   * Get all posts in a club
   */
  getClubPosts: async (clubId, params = {}) => {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeDeleted = false,
      mediaType,
      authorType,
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
      includeDeleted: includeDeleted.toString(),
    });

    if (mediaType) queryParams.append('mediaType', mediaType);
    if (authorType) queryParams.append('authorType', authorType);

    const response = await adminApi.get(
      `/api/web/clubs/${clubId}/posts?${queryParams}`
    );
    return response.data;
  },

  /**
   * Get single post details
   */
  getPostById: async (postId, includeDeleted = false) => {
    const response = await adminApi.get(
      `/api/web/clubs/posts/${postId}?includeDeleted=${includeDeleted}`
    );
    return response.data;
  },

  /**
   * Delete a post (soft delete)
   */
  deletePost: async (postId) => {
    const response = await adminApi.delete(`/api/web/clubs/posts/${postId}`);
    return response.data;
  },
};
```

#### 2. React Hook for Club Posts

```javascript
// hooks/useClubPosts.js
import { useState, useEffect, useCallback } from 'react';
import { clubPostApi } from '../services/clubPostApi';
import { toast } from 'react-toastify'; // or your notification library

export const useClubPosts = (clubId) => {
  const [posts, setPosts] = useState([]);
  const [club, setClub] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters state
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    includeDeleted: false,
    mediaType: undefined,
    authorType: undefined,
  });

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    if (!clubId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await clubPostApi.getClubPosts(clubId, filters);

      if (response.status === 200) {
        setPosts(response.data.posts);
        setClub(response.data.club);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch posts');
      toast.error('Failed to fetch club posts');
    } finally {
      setLoading(false);
    }
  }, [clubId, filters]);

  // Delete post
  const deletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return false;
    }

    try {
      const response = await clubPostApi.deletePost(postId);

      if (response.status === 200) {
        toast.success('Post deleted successfully');

        // Refresh posts list
        await fetchPosts();

        return true;
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to delete post';
      toast.error(errorMsg);
      return false;
    }
  };

  // Update filters
  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Change page
  const goToPage = (page) => {
    updateFilters({ page });
  };

  // Toggle deleted posts view
  const toggleDeletedPosts = () => {
    updateFilters({ includeDeleted: !filters.includeDeleted, page: 1 });
  };

  // Fetch posts when filters change
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return {
    // Data
    posts,
    club,
    pagination,
    loading,
    error,
    filters,

    // Actions
    fetchPosts,
    deletePost,
    updateFilters,
    goToPage,
    toggleDeletedPosts,
  };
};
```

#### 3. Complete Component Example

```jsx
// components/ClubPostsManager.jsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useClubPosts } from '../hooks/useClubPosts';
import {
  Table,
  Button,
  Badge,
  Spinner,
  Pagination,
  Form,
  Card,
  Image,
  Modal,
} from 'react-bootstrap'; // or your UI library

const ClubPostsManager = () => {
  const { clubId } = useParams();
  const {
    posts,
    club,
    pagination,
    loading,
    error,
    filters,
    deletePost,
    updateFilters,
    goToPage,
    toggleDeletedPosts,
  } = useClubPosts(clubId);

  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);

  // Handle delete
  const handleDelete = async (postId) => {
    const success = await deletePost(postId);
    if (success && showPostModal) {
      setShowPostModal(false);
      setSelectedPost(null);
    }
  };

  // View post details
  const viewPost = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  if (loading && !posts.length) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <p className="mt-2">Loading posts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div className="club-posts-manager">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>{club?.name} - Posts</h2>
          <p className="text-muted mb-0">
            {club?.memberCount} members · {club?.postCount} posts
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <div className="row g-3">
            {/* Sort By */}
            <div className="col-md-3">
              <Form.Group>
                <Form.Label>Sort By</Form.Label>
                <Form.Select
                  value={filters.sortBy}
                  onChange={(e) => updateFilters({ sortBy: e.target.value, page: 1 })}
                >
                  <option value="createdAt">Date Created</option>
                  <option value="likeCount">Likes</option>
                  <option value="commentCount">Comments</option>
                </Form.Select>
              </Form.Group>
            </div>

            {/* Sort Order */}
            <div className="col-md-2">
              <Form.Group>
                <Form.Label>Order</Form.Label>
                <Form.Select
                  value={filters.sortOrder}
                  onChange={(e) => updateFilters({ sortOrder: e.target.value, page: 1 })}
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </Form.Select>
              </Form.Group>
            </div>

            {/* Media Type */}
            <div className="col-md-2">
              <Form.Group>
                <Form.Label>Media Type</Form.Label>
                <Form.Select
                  value={filters.mediaType || ''}
                  onChange={(e) =>
                    updateFilters({
                      mediaType: e.target.value || undefined,
                      page: 1,
                    })
                  }
                >
                  <option value="">All</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                </Form.Select>
              </Form.Group>
            </div>

            {/* Author Type */}
            <div className="col-md-2">
              <Form.Group>
                <Form.Label>Author</Form.Label>
                <Form.Select
                  value={filters.authorType || ''}
                  onChange={(e) =>
                    updateFilters({
                      authorType: e.target.value || undefined,
                      page: 1,
                    })
                  }
                >
                  <option value="">All</option>
                  <option value="User">Users</option>
                  <option value="Admin">Admins</option>
                </Form.Select>
              </Form.Group>
            </div>

            {/* Show Deleted */}
            <div className="col-md-3 d-flex align-items-end">
              <Form.Check
                type="checkbox"
                label="Show deleted posts"
                checked={filters.includeDeleted}
                onChange={toggleDeletedPosts}
              />
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Posts Table */}
      <Card>
        <Card.Body>
          {loading && (
            <div className="text-center py-3">
              <Spinner animation="border" size="sm" />
            </div>
          )}

          {!loading && posts.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p>No posts found</p>
            </div>
          ) : (
            <>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Thumbnail</th>
                    <th>Content</th>
                    <th>Author</th>
                    <th style={{ width: '120px' }}>Stats</th>
                    <th style={{ width: '120px' }}>Date</th>
                    <th style={{ width: '100px' }}>Status</th>
                    <th style={{ width: '150px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      className={post.isDeleted ? 'table-secondary' : ''}
                    >
                      {/* Thumbnail */}
                      <td>
                        {post.media && post.media.length > 0 ? (
                          <Image
                            src={post.media[0].thumbnail || post.media[0].url}
                            alt="Post"
                            thumbnail
                            style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            className="bg-light d-flex align-items-center justify-content-center"
                            style={{ width: '60px', height: '60px' }}
                          >
                            <i className="bi bi-image text-muted"></i>
                          </div>
                        )}
                      </td>

                      {/* Content */}
                      <td>
                        <div style={{ maxWidth: '300px' }}>
                          {post.content ? (
                            <p className="mb-0 text-truncate">{post.content}</p>
                          ) : (
                            <span className="text-muted">No caption</span>
                          )}
                          <small className="text-muted">
                            {post.media?.length || 0} media item(s)
                          </small>
                        </div>
                      </td>

                      {/* Author */}
                      <td>
                        {post.author ? (
                          <>
                            <div className="fw-semibold">{post.author.name}</div>
                            <small className="text-muted">
                              {post.author.type}
                            </small>
                          </>
                        ) : (
                          <span className="text-muted">Unknown</span>
                        )}
                      </td>

                      {/* Stats */}
                      <td>
                        <div className="small">
                          <div>❤️ {post.likeCount}</div>
                          <div>💬 {post.commentCount}</div>
                          <div>📤 {post.shareCount}</div>
                        </div>
                      </td>

                      {/* Date */}
                      <td>
                        <small>
                          {new Date(post.createdAt).toLocaleDateString()}
                        </small>
                      </td>

                      {/* Status */}
                      <td>
                        {post.isDeleted ? (
                          <Badge bg="danger">Deleted</Badge>
                        ) : (
                          <Badge bg="success">Active</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="d-flex gap-2">
                          <Button
                            size="sm"
                            variant="info"
                            onClick={() => viewPost(post)}
                          >
                            View
                          </Button>
                          {!post.isDeleted && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDelete(post.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-4">
                  <div className="text-muted">
                    Showing {(pagination.currentPage - 1) * filters.limit + 1} -{' '}
                    {Math.min(
                      pagination.currentPage * filters.limit,
                      pagination.totalCount
                    )}{' '}
                    of {pagination.totalCount} posts
                  </div>

                  <Pagination>
                    <Pagination.First
                      onClick={() => goToPage(1)}
                      disabled={!pagination.hasPrevPage}
                    />
                    <Pagination.Prev
                      onClick={() => goToPage(pagination.currentPage - 1)}
                      disabled={!pagination.hasPrevPage}
                    />

                    {/* Page numbers */}
                    {[...Array(pagination.totalPages)].map((_, idx) => {
                      const pageNum = idx + 1;
                      // Show only nearby pages
                      if (
                        pageNum === 1 ||
                        pageNum === pagination.totalPages ||
                        Math.abs(pageNum - pagination.currentPage) <= 2
                      ) {
                        return (
                          <Pagination.Item
                            key={pageNum}
                            active={pageNum === pagination.currentPage}
                            onClick={() => goToPage(pageNum)}
                          >
                            {pageNum}
                          </Pagination.Item>
                        );
                      } else if (
                        pageNum === pagination.currentPage - 3 ||
                        pageNum === pagination.currentPage + 3
                      ) {
                        return <Pagination.Ellipsis key={pageNum} disabled />;
                      }
                      return null;
                    })}

                    <Pagination.Next
                      onClick={() => goToPage(pagination.currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                    />
                    <Pagination.Last
                      onClick={() => goToPage(pagination.totalPages)}
                      disabled={!pagination.hasNextPage}
                    />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Post Details Modal */}
      <Modal
        show={showPostModal}
        onHide={() => setShowPostModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Post Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPost && (
            <div>
              {/* Media Gallery */}
              {selectedPost.media && selectedPost.media.length > 0 && (
                <div className="mb-3">
                  <div className="row g-2">
                    {selectedPost.media.map((media, idx) => (
                      <div key={idx} className="col-md-6">
                        {media.type === 'image' ? (
                          <Image src={media.url} alt={`Media ${idx + 1}`} fluid />
                        ) : (
                          <video controls style={{ width: '100%' }}>
                            <source src={media.url} type="video/mp4" />
                          </video>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="mb-3">
                <h6>Content</h6>
                <p>{selectedPost.content || 'No caption'}</p>
              </div>

              {/* Author */}
              <div className="mb-3">
                <h6>Author</h6>
                {selectedPost.author ? (
                  <div>
                    <p className="mb-1">
                      <strong>Name:</strong> {selectedPost.author.name}
                    </p>
                    <p className="mb-1">
                      <strong>Email:</strong> {selectedPost.author.email}
                    </p>
                    <p className="mb-0">
                      <strong>Type:</strong>{' '}
                      <Badge bg="secondary">{selectedPost.author.type}</Badge>
                    </p>
                  </div>
                ) : (
                  <p className="text-muted">Unknown author</p>
                )}
              </div>

              {/* Club */}
              <div className="mb-3">
                <h6>Club</h6>
                <p className="mb-0">
                  <strong>Name:</strong> {selectedPost.club?.name}
                </p>
              </div>

              {/* Stats */}
              <div className="mb-3">
                <h6>Engagement</h6>
                <div className="row">
                  <div className="col-4">
                    <div className="text-center p-2 bg-light rounded">
                      <div className="fs-4">❤️</div>
                      <div>{selectedPost.likeCount} Likes</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="text-center p-2 bg-light rounded">
                      <div className="fs-4">💬</div>
                      <div>{selectedPost.commentCount} Comments</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="text-center p-2 bg-light rounded">
                      <div className="fs-4">📤</div>
                      <div>{selectedPost.shareCount} Shares</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="mb-3">
                <h6>Metadata</h6>
                <p className="mb-1">
                  <strong>Created:</strong>{' '}
                  {new Date(selectedPost.createdAt).toLocaleString()}
                </p>
                <p className="mb-1">
                  <strong>Updated:</strong>{' '}
                  {new Date(selectedPost.updatedAt).toLocaleString()}
                </p>
                {selectedPost.isDeleted && (
                  <p className="mb-0 text-danger">
                    <strong>Deleted:</strong>{' '}
                    {new Date(selectedPost.deletedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {selectedPost && !selectedPost.isDeleted && (
            <Button
              variant="danger"
              onClick={() => handleDelete(selectedPost.id)}
            >
              Delete Post
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowPostModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ClubPostsManager;
```

---

## UI/UX Recommendations

### 1. **Posts List View**

- ✅ Show thumbnail preview (first media item)
- ✅ Display post caption (truncated)
- ✅ Show author name and type badge
- ✅ Display engagement metrics (likes, comments, shares)
- ✅ Add "View" button for full details
- ✅ Add "Delete" button (with confirmation)
- ✅ Highlight deleted posts (different background color)

### 2. **Filters & Sorting**

```
+------------------+-------------+-------------+-------------+-------------------+
| Sort: [Dropdown] | Order: [v]  | Media: [v]  | Author: [v] | [x] Show Deleted  |
+------------------+-------------+-------------+-------------+-------------------+
```

**Filter Options:**

- **Sort By**: Date Created, Likes, Comments
- **Order**: Newest First / Oldest First
- **Media Type**: All / Images / Videos
- **Author**: All / Users / Admins
- **Show Deleted**: Checkbox

### 3. **Post Details Modal**

When clicking "View" button, show:

- 📸 Full media gallery (images/videos)
- 📝 Full post content/caption
- 👤 Author details (name, email, type)
- 🏢 Club information
- 📊 Engagement stats (visual cards)
- 📅 Timestamps (created, updated, deleted)
- 🗑️ Delete button (if not already deleted)

### 4. **Pagination**

```
Showing 1-20 of 145 posts

[First] [Previous] [1] [2] [3] ... [8] [Next] [Last]
```

### 5. **Confirmation Dialogs**

```javascript
// Delete confirmation
if (!window.confirm('Are you sure you want to delete this post?')) {
  return;
}
```

Consider using a nicer modal library:

- SweetAlert2
- React Confirm Alert
- Custom modal component

### 6. **Loading States**

- Show spinner when fetching posts
- Disable buttons during delete operation
- Show skeleton loaders for better UX

### 7. **Empty States**

```
╔═══════════════════════════════════╗
║                                   ║
║         📭 No posts found         ║
║                                   ║
║   Try adjusting your filters     ║
║                                   ║
╚═══════════════════════════════════╝
```

---

## Error Handling

### Common Error Scenarios

#### 1. **Unauthorized (401)**

```javascript
{
  "status": 401,
  "message": "No token provided"
}
```

**Action**: Redirect to login page

#### 2. **Forbidden (403)**

```javascript
{
  "status": 403,
  "message": "Admin access required"
}
```

**Action**: Show error message, redirect to dashboard

#### 3. **Not Found (404)**

```javascript
{
  "status": 404,
  "message": "Club not found"
}
```

**Action**: Show error message, redirect to clubs list

#### 4. **Conflict (409)**

```javascript
{
  "status": 409,
  "message": "Post is already deleted"
}
```

**Action**: Refresh posts list, show info message

#### 5. **Server Error (500)**

```javascript
{
  "status": 500,
  "message": "Internal server error"
}
```

**Action**: Show error toast, allow retry

### Error Handler Utility

```javascript
// utils/errorHandler.js
import { toast } from 'react-toastify';

export const handleApiError = (error, navigate) => {
  const status = error.response?.status;
  const message = error.response?.data?.message || 'An error occurred';

  switch (status) {
    case 401:
      toast.error('Session expired. Please login again.');
      localStorage.removeItem('adminToken');
      navigate('/admin/login');
      break;

    case 403:
      toast.error('You do not have permission to perform this action.');
      navigate('/admin/dashboard');
      break;

    case 404:
      toast.error(message);
      break;

    case 409:
      toast.warning(message);
      break;

    case 500:
      toast.error('Server error. Please try again later.');
      break;

    default:
      toast.error(message);
  }
};
```

---

## Testing Checklist

### Functional Tests

- [ ] **List Posts**

  - [ ] Load posts for a club
  - [ ] Pagination works correctly
  - [ ] Filters work (sort, media type, author type)
  - [ ] "Show deleted" checkbox toggles deleted posts
  - [ ] Empty state displays when no posts
- [ ] **View Post Details**

  - [ ] Modal opens with full post details
  - [ ] All media displays correctly
  - [ ] Author and club info shown
  - [ ] Engagement stats visible
- [ ] **Delete Post**

  - [ ] Confirmation dialog appears
  - [ ] Post deletes successfully
  - [ ] Toast notification shows
  - [ ] List refreshes automatically
  - [ ] Club postCount decrements
  - [ ] Deleted post shows in list when "Show deleted" enabled
- [ ] **Error Handling**

  - [ ] 401 redirects to login
  - [ ] 404 shows appropriate message
  - [ ] 409 (already deleted) handled gracefully
  - [ ] Network errors display toast

### UI/UX Tests

- [ ] Loading spinners display during API calls
- [ ] Buttons disable during operations
- [ ] Responsive design works on mobile
- [ ] Images load with proper aspect ratios
- [ ] Pagination controls work correctly
- [ ] Filter dropdowns update results

### Edge Cases

- [ ] Club with 0 posts
- [ ] Post with no media
- [ ] Post with no caption
- [ ] Deleted post visibility
- [ ] Very long post captions
- [ ] Very large images/videos

---

## Quick Start Checklist

1. **Setup API Service**

   - [ ] Create `services/clubPostApi.js`
   - [ ] Add axios instance with auth interceptor
   - [ ] Implement all three API methods
2. **Create Custom Hook**

   - [ ] Create `hooks/useClubPosts.js`
   - [ ] Implement state management
   - [ ] Add filter handling
   - [ ] Add delete functionality
3. **Build Component**

   - [ ] Create `ClubPostsManager.jsx`
   - [ ] Add filters section
   - [ ] Create posts table
   - [ ] Add pagination
   - [ ] Implement post details modal
4. **Add Route**

   ```javascript
   <Route
     path="/admin/clubs/:clubId/posts"
     element={<ClubPostsManager />}
   />
   ```
5. **Test Everything**

   - [ ] Test in different clubs
   - [ ] Test all filters
   - [ ] Test pagination
   - [ ] Test delete functionality
   - [ ] Test error scenarios

---

## Additional Resources

### Test Admin Credentials

```
Username: testadmin
Password: Test123456
```

### Sample Club IDs (from test database)

```
Yoga Club: 695be8ec69cdb8c106f6c088
Meditation Club: 695ba829bc9262f2892f4753
Art Club: 695bec0869cdb8c106f6c0d7
```

### API Base URL

```
Development: http://localhost:5000
Production: YOUR_PRODUCTION_URL
```

---

## Support

If you encounter any issues during integration:

1. Check the [API_TEST_RESULTS.md](API_TEST_RESULTS.md) for detailed test results
2. Review error responses in browser console
3. Check network tab for request/response details
4. Verify admin token is being sent correctly
5. Test with Postman/Thunder Client first

**Backend API Status**: ✅ All endpoints tested and working correctly

---

## Summary

This integration guide provides:

- ✅ Complete API documentation with examples
- ✅ React + Axios implementation
- ✅ Custom hook for state management
- ✅ Full working component with all features
- ✅ UI/UX recommendations
- ✅ Error handling patterns
- ✅ Testing checklist

**Estimated Integration Time**: 2-4 hours for experienced developer

The backend APIs are fully tested and production-ready. Follow this guide to integrate club post management into your admin panel smoothly and efficiently!
