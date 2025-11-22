# Interactive OBP Demo

This is an interactive demonstration of the Open Banking Platform (OBP) customer data exchange flow.

## Features

- **Two Demo Scenarios**: Bank Transfer and Life Insurance
- **Real API Integration**: Makes actual calls to the OBP backend
- **Three Horizontal Splits**:
  - **Split 1**: Input forms and user actions
  - **Split 2**: Request/Response display (shows actual API calls and responses)
  - **Split 3**: Background logs (detailed API operations, consent management, etc.)
- **Automated Consent Flow**: Demonstrates the complete consent lifecycle
- **Demo User Option**: Pre-filled data or custom input

## How to Use

### 1. Start the API Server

Make sure the API server is running:

```bash
cd /Users/lucien/programming/obp-concept/api
npm install
npm start
```

The server should start on `http://localhost:3000`

### 2. Access the Demo

Open your browser and navigate to:

```
http://localhost:3000/demo/interactive-demo.html
```

### 3. Flow Through the Demo

**Step 1: Choose Data Mode**
- Click "Demo-Benutzer verwenden" to use pre-filled demo data
- Click "Eigene Daten eingeben" to enter your own data

**Step 2: Select Scenario**
- Click "Demo: Banküberweisung" for the bank transfer scenario
- Click "Demo: Lebensversicherung" for the life insurance scenario

**Step 3: Bank A Registration**
- Fill out the customer registration form (or it's pre-filled if you chose demo user)
- Click "Registrieren" to submit
- Watch the API request/response in Split 2 and background operations in Split 3

**Step 4: Data Transfer Request**
- Enter minimal data (name and birthdate)
- Click "Daten anfordern"
- The demo will automatically:
  - Check if customer exists
  - Create a consent request
  - Auto-approve the consent

**Step 5: Data Retrieval**
- Automatically retrieves full customer data using the consent token
- Displays the complete dataset

**Step 6: Success**
- Shows success message and summary
- Compares minimal input vs. full data retrieved
- Displays complete flow log

## Technical Details

### API Endpoints Used

1. `PUT /v1/customer/:hash` - Create/update customer at Bank A
2. `POST /v1/customer/check` - Verify customer exists
3. `POST /v1/consent` - Create consent request
4. `POST /v1/consent/:id/approve` - Approve consent
5. `POST /v1/customer/data` - Retrieve customer data with consent

### Demo User Data

When using the demo user option, the following data is used:

- **Name**: Maria Schmidt
- **Birth Date**: 1990-05-20
- **Location**: Zürich, Switzerland
- **Email**: maria.schmidt@example.ch
- **Phone**: +41791234567

### Environment Configuration

The demo requires the API server to be in development mode. Make sure your `.env` file contains:

```env
NODE_ENV=development
SKIP_CLIENT_AUTH=true
ALLOWED_ORIGINS=https://localhost:3000,http://localhost:3000
```

## Architecture

- **Frontend**: Vanilla HTML, CSS (inline), and JavaScript
- **Backend**: Node.js/Express API
- **No external dependencies**: Everything is self-contained in a single HTML file
- **Real-time updates**: All API calls happen live, no mock data

## Troubleshooting

### Demo won't load
- Ensure the API server is running on port 3000
- Check browser console for errors
- Verify CORS is configured correctly

### API calls fail
- Ensure `NODE_ENV=development` is set
- Ensure `SKIP_CLIENT_AUTH=true` is set in `.env`
- Check that the customer routes use optional authentication in development mode
- Check the browser console and API server logs for error messages

### Data doesn't persist
- The demo uses in-memory storage
- Restarting the API server will clear all data
- This is intentional for demo purposes
