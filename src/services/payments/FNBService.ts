/**
 * FNB Payment Service
 *
 * Handles FNB 3D Secure payment flow. Uses credentials from payment provider
 * (metadata: fnb_base_url, fnb_api_key_3d, fnb_api_inst_3d, fnb_secret_key; return_url).
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const DUPLICATE_WINDOW_MINUTES = 5;
const BLOCKED_STATUSES = ['pending', 'Busy', 'paid'] as const;

export interface FNBProviderConfig {
  baseUrl: string;
  apiKey3d: string;
  apiInst3d: string;
  secretKey?: string;
  returnUrl: string; // Base URL for thank-you redirect (e.g. https://app.com)
}

export interface InitiateFnbPaymentResult {
  success: true;
  url: string;
  reference: string;
}

export interface InitiateFnbPaymentError {
  success: false;
  error: string;
  code?: 'DUPLICATE' | 'FNB_API_ERROR' | 'CONFIG_ERROR' | 'VALIDATION_ERROR';
}

export type InitiateFnbPaymentResponse = InitiateFnbPaymentResult | InitiateFnbPaymentError;

export class FNBService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Check if user has a recent payment that blocks new initiations
   */
  private async hasRecentBlockingPayment(userId: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000);
    const result = await this.pool.query(
      `SELECT 1 FROM public.fnb_payments
       WHERE user_id = $1 AND status = ANY($2::text[]) AND created_at > $3
       LIMIT 1`,
      [userId, BLOCKED_STATUSES, cutoff]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Call FNB /ape/api/pay to get redirect URL.
   * Uses provider config (no .env fallback).
   */
  private async callFnbPay(
    config: FNBProviderConfig,
    description: string,
    amountCents: number,
    reference: string,
    returnUrl: string
  ): Promise<{ url?: string; error?: string }> {
    const { baseUrl, apiKey3d, apiInst3d, secretKey } = config;

    if (!baseUrl || !apiKey3d || !apiInst3d) {
      return {
        error: 'FNB configuration missing. Add FNB Base URL, API Key 3D, and Inst 3D in payment provider settings.',
      };
    }

    const url = `${baseUrl.replace(/\/$/, '')}/ape/api/pay`;

    // Request format per examples/FNBService.ts: paymentDTO with basket.usingBasketDetails
    const items = [{ description, amount: amountCents }];
    const payload = {
      paymentDTO: {
        paymentSplit: [],
        callbackURL: returnUrl,
        basket: {
          usingBasketDetails: {
            items,
            merchanOrderNumber: reference, // FNB API typo
          },
        },
        storeCardInVault: true,
      },
      storeCardInVault: false,
      ttl: 120000,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'API-KEY': apiKey3d,
          'INST-KEY': apiInst3d,
          'Content-Type': 'application/json',
          ...(secretKey && { 'SECRET-KEY': secretKey }),
        },
        maxRedirects: 0,
        timeout: 15000,
        validateStatus: () => true,
      });

      // FNB returns 301/302/308 with Content-Location header (per examples/FNBService.ts)
      if ([301, 302, 308].includes(response.status)) {
        const redirectUrl = response.headers['content-location'];
        if (redirectUrl) return { url: redirectUrl };
      }

      if (response.status >= 200 && response.status < 300) {
        const data = response.data;
        const redirectUrl = typeof data?.url === 'string' ? data.url : data?.redirectUrl ?? data?.paymentUrl ?? response.headers['content-location'];
        if (redirectUrl) return { url: redirectUrl };
        return {
          error: `FNB response missing redirect URL. Status: ${response.status}. Check Content-Location header.`,
        };
      }

      const data = response.data;
      const errMsg =
        data?.message ?? data?.error ?? response.statusText ?? `FNB API returned ${response.status}`;
      return { error: `FNB API error: ${errMsg}` };
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? 'Unknown FNB error';
      return { error: `FNB API request failed: ${message}` };
    }
  }

  /**
   * Initiate FNB payment: duplicate check, call FNB, save record, return url + reference.
   * Uses provider config (no .env).
   */
  async initiatePayment(
    userId: string,
    description: string,
    amount: number,
    providerConfig: FNBProviderConfig
  ): Promise<InitiateFnbPaymentResponse> {
    // Validate
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return { success: false, error: 'description is required and must be a non-empty string', code: 'VALIDATION_ERROR' };
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'amount must be a positive number', code: 'VALIDATION_ERROR' };
    }

    const { returnUrl: baseUrl } = providerConfig;
    if (!baseUrl) {
      return { success: false, error: 'Return URL is required. Add it in payment provider settings.', code: 'CONFIG_ERROR' };
    }

    // Duplicate check
    const hasBlocking = await this.hasRecentBlockingPayment(userId);
    if (hasBlocking) {
      return {
        success: false,
        error: 'A payment is already pending or was completed in the last 5 minutes for this user',
        code: 'DUPLICATE',
      };
    }

    const reference = `fnb-${uuidv4()}`;
    const amountCents = Math.round(amount * 100);
    const returnUrl = `${baseUrl.replace(/\/$/, '')}/thankyou/${reference}`;

    const fnbResult = await this.callFnbPay(providerConfig, description, amountCents, reference, returnUrl);
    if (fnbResult.error) {
      return {
        success: false,
        error: fnbResult.error,
        code: fnbResult.error.includes('missing') || fnbResult.error.includes('required') ? 'CONFIG_ERROR' : 'FNB_API_ERROR',
      };
    }

    const redirectUrl = fnbResult.url!;

    await this.pool.query(
      `INSERT INTO public.fnb_payments (user_id, reference, status, price, gateway, signature, payload, updated_at)
       VALUES ($1, $2, 'pending', $3, 'fnb_pay', $4, $5, CURRENT_TIMESTAMP)`,
      [userId, reference, amount, redirectUrl, description]
    );

    return { success: true, url: redirectUrl, reference };
  }
}
