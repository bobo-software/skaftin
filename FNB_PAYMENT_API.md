# FNB Payment API Documentation

## Overview

The FNB payment integration uses **3D Secure redirect flow**. The client initiates a payment, receives a redirect URL from the API, and the user is sent to FNB's hosted payment page to enter card details and complete the transaction.

---

## Endpoint

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/payments/handle_fnb_payment` | Bearer token required |

---

## Request

### Headers

```
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
```

### Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | number | Yes | Project ID that has the FNB payment provider configured |
| `provider_id` | number | No | Specific FNB provider ID. If omitted, uses first active FNB provider for the project |
| `description` | string | Yes | Payment description shown on the FNB payment page |
| `amount` | number | Yes | Amount in currency units (e.g. 99.50 for R99.50). Converted to cents for FNB |

Credentials are read from the payment provider (metadata: fnb_base_url, fnb_api_key_3d, fnb_api_inst_3d, fnb_secret_key; return_url).

### Example

```json
{
  "project_id": 1,
  "description": "Voucher purchase",
  "amount": 99.50
}
```

---

## Response

### Success (200)

```json
{
  "success": true,
  "message": "Redirect to complete payment",
  "data": {
    "url": "https://sandbox.ms.fnb.co.za/ape/payment/...",
    "reference": "fnb-b3996d67-d6c1-4cd4-8827-ed7fa4d840db"
  },
  "timestamp": "2026-02-01T03:38:05.276Z"
}
```

| Field | Description |
|-------|-------------|
| `data.url` | Redirect URL. Send the user to this URL to complete payment |
| `data.reference` | Unique reference for this payment. Use when verifying status or for support |

### Frontend Flow

1. User selects amount and description, then confirms payment
2. Call `POST /api/payments/handle_fnb_payment` with the body
3. On success, redirect the user to `data.url` (e.g. `window.location.href = data.url`)
4. User enters card details on FNB's page
5. FNB redirects back to the thank-you URL after payment
6. On your thank-you page, use the `reference` or query params from FNB to confirm the result

---

## Flow Diagram

```
┌─────────────┐     POST /handle_fnb_payment      ┌─────────────┐
│   Client    │ ─────────────────────────────────▶│   API       │
│  (App/Web)  │     { project_id, description, amount }       │  (slipsam)  │
└─────────────┘                                   └──────┬──────┘
       │                                                  │
       │                                                  │ 1. Validate auth & body
       │                                                  │ 2. Check no pending payment (5 min)
       │                                                  │ 3. Call FNB /ape/api/pay
       │                                                  │ 4. Save payment record (pending)
       │                                                  │ 5. Return redirect URL
       │◀─────────────────────────────────────────────────┘
       │     { url, reference }
       │
       │  Redirect user to url
       ▼
┌─────────────┐
│  FNB Hosted │  User enters card, completes 3DS
│  Payment    │
│  Page       │
└──────┬──────┘
       │
       │  FNB redirects to thank-you URL
       ▼
┌─────────────┐
│  Your       │  Show confirmation, poll for status, etc.
│  Thank You  │
│  Page       │
└─────────────┘
```

---

## Credentials (Payment Provider)

`handle_fnb_payment` uses credentials from the payment provider for the given `project_id`. Add an FNB provider in the dashboard (Payments → Providers) with:

| Provider field | Maps to | Description |
|----------------|---------|-------------|
| FNB Base URL | `fnb_base_url` | FNB API base URL (e.g. `https://sandbox.ms.fnb.co.za`) |
| API Key 3D | `fnb_api_key_3d` | API key for 3D Secure flow |
| Inst 3D | `fnb_api_inst_3d` | Instance key for 3D Secure flow |
| Secret Key | `fnb_secret_key` | Optional secret key |
| Return URL | `return_url` | Base URL for thank-you redirect (e.g. `https://app.com`) |

---

## Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid `project_id`, `description`, or `amount`; no FNB provider for project |
| 401 | Missing or invalid Bearer token |
| 409 | A payment is already pending or was completed in the last 5 minutes for this user |
| 500 | FNB API error or server error |

### Example Error

```json
{
  "success": false,
  "message": "amount must be a positive number",
  "timestamp": "2026-02-01T03:38:05.276Z"
}
```

---

## Duplicate Payment Prevention

The API blocks new FNB payments if the user has a payment with status `pending`, `Busy`, or `paid` in the last 5 minutes. This reduces duplicate charges from double-clicks or retries.

---

## Payment Record (Database)

Each successful initiation creates a row in `payments`:

| Column | Example |
|--------|---------|
| `user_id` | Authenticated user |
| `reference` | `fnb-b3996d67-d6c1-4cd4-8827-ed7fa4d840db` |
| `status` | `pending` |
| `price` | `99.5` |
| `gateway` | `fnb_pay` |
| `signature` | Redirect URL from FNB |
| `payload` | Description string |

Status updates (e.g. `paid`, `failed`) are typically applied by a webhook or callback handler that you implement to receive FNB notifications.
