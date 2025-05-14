
# Need-It-Now Hub Backend

This backend provides the API for the Need-It-Now Hub application. It includes user authentication, post management, ratings, and notification systems.

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)

### Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```
   cd backend
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Create a `.env` file based on the `.env.example`:
   ```
   cp .env.example .env
   ```
5. Update the `.env` file with your database credentials and JWT secret
6. Create the PostgreSQL database:
   ```sql
   CREATE DATABASE needitdb;
   ```
7. Import the schema to your database:
   ```
   psql -U your_username -d needitdb -f db/schema.sql
   ```

### Running the Server

```
npm run dev
```

The server will start on the port specified in your `.env` file (default: 5000).

## API Documentation

### Authentication Endpoints

- **POST /api/auth/register**: Register a new user
- **POST /api/auth/login**: Login a user
- **GET /api/auth/me**: Get current user info

### Posts Endpoints

- **GET /api/posts**: Get all posts with optional filters
- **GET /api/posts/:id**: Get a specific post by ID
- **POST /api/posts**: Create a new post
- **DELETE /api/posts/:id**: Delete a post

### Ratings Endpoints

- **POST /api/ratings**: Add a rating to a post
- **GET /api/ratings/post/:postId**: Get ratings for a post

### Users Endpoints

- **GET /api/users/:id**: Get user profile
- **POST /api/users/subscribe/category**: Subscribe to category notifications
- **DELETE /api/users/unsubscribe/category**: Unsubscribe from category notifications
- **GET /api/users/notifications**: Get user notifications
- **PUT /api/users/notifications/:id/read**: Mark notification as read

## Frontend Integration

To connect the React frontend to this backend:

1. Update the API URLs in your frontend code to point to this backend server
2. Use the JWT token returned from login/register for authenticated requests
3. Handle image uploads using FormData for post creation
