# Spin & Win Backend

A production-ready Node.js backend for a Spin & Win promotional system.
This system is designed to handle high concurrency and safe-guard against over-winning using database-level locking.

## Prerequisites

- Node.js v16+
- PostgreSQL Database (Supabase recommended)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Database Setup**
   - Create a PostgreSQL database.
   - Run the contents of `setup.sql` in your database query tool (e.g., Supabase SQL Editor, pgAdmin).
   - This script creates the necessary tables (`campaign_limits`, `customers`, `spins`, `redemptions`) and initializes the winner limit.

3. **Configuration**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and set your `DATABASE_URL`.

4. **Run the Server**
   ```bash
   npm start
   ```
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### 1. **Spin the Wheel**
**POST** `/api/spin`
- **Body**: `{ "customerId": "UUID" }`
- **Logic**:
  - Checks if user has already spun (DB enforced).
  - Checks if global winner limit is reached (DB locked).
  - Returns win/loss status.

### 2. **Redeem Prize**
**POST** `/api/redeem`
- **Body**: `{ "code": "WIN-XXXXXXXX" }`
- **Logic**:
  - Validates code existence.
  - Checks if already redeemed.
  - Marks as redeemed atomically.

### 3. **Register Customer (Test Helper)**
**POST** `/api/register`
- **Body**: `{ "email": "test@example.com" }`
- **Returns**: Created customer object with UUID.

## concurrency & Safety

- **Transaction Isolation**: Uses `BEGIN ... COMMIT/ROLLBACK` blocks for all critical operations.
- **Row Locking**: Uses `SELECT ... FOR UPDATE` to lock customer records (preventing double spins) and campaign limit records (preventing race conditions on winner count).
- **Atomic Updates**: All state changes happen within the transaction boundary.
