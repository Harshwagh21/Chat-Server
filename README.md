# Chat-Server

High-performance location-based chat application backend built with Node.js, Express, MongoDB, Redis, and Socket.IO.

## Features

- **Real-time Chat**: Socket.IO powered messaging
- **Location-based Discovery**: Find nearby users with privacy protection
- **Private Channels**: Invite-only rooms with live location sharing
- **Secure Authentication**: JWT-based auth with bcrypt password hashing
- **High Performance**: Redis caching and MongoDB geospatial indexing

## Quick Start

1. **Clone and Install**
   ```bash
   git clone <repo-url>
   cd chat-server
   pnpm install
   ```

2. **Environment Setup**
   ```bash
   cp env.example .env
   # Edit .env with your MongoDB and Redis URIs
   ```

3. **Start Development Server**
   ```bash
   pnpm dev
   ```

4. **Run Tests**
   ```bash
   pnpm test
   ```

## Architecture

- **Clean Architecture**: Separated concerns with services, controllers, and routes
- **TDD Approach**: Test-driven development with Jest and Supertest
- **Hybrid Database**: MongoDB for persistence, Redis for real-time caching
- **Location Privacy**: Coordinate obfuscation with distance-only responses


## License

ISC