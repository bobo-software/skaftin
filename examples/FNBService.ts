/**
 * FNB Payment Service - Implements FNB payment flow per FNB_PAYMENT_FLOW.md
 * Supports both 3D Secure (redirect) and tokenized (MOTO) payments.
 */

import axios, { AxiosError } from 'axios';

export interface PaymentItem {
  description: string;
  amount: number; // Amount in cents
}

interface FNBConfig {
  apiKey: string;
  apiInst: string;
  baseUrl: string;
  secretKey?: string;
  apiBaseUrl: string;
}

export class FNBService {
  private config: FNBConfig;

  constructor(useCardToken: boolean) {
    const baseUrl = process.env.FNB_BASE_URL;
    const apiBaseUrl = process.env.API_BASE_URL;
    if (!baseUrl) throw new Error('FNB_BASE_URL is required');
    if (!apiBaseUrl) throw new Error('API_BASE_URL is required for FNB callback URL');

    this.config = {
      baseUrl,
      apiBaseUrl,
      apiKey: useCardToken
        ? (process.env.FNB_API_KEY ?? '')
        : (process.env.FNB_API_KEY_3D ?? ''),
      apiInst: useCardToken
        ? (process.env.FNB_API_INST ?? '')
        : (process.env.FNB_API_INST_3D ?? ''),
      secretKey: process.env.FNB_SECRET_KEY,
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'API-KEY': this.config.apiKey,
      'INST-KEY': this.config.apiInst,
      'Content-Type': 'application/json',
    };
    if (this.config.secretKey) {
      headers['SECRET-KEY'] = this.config.secretKey;
    }
    return headers;
  }

  async processPayment(
    cardToken: string | null,
    items: PaymentItem[],
    amount: number,
    reference: string,
    useCardToken: boolean
  ): Promise<string> {
    const url = cardToken
      ? `${this.config.baseUrl}/ape/api/pay/simple`
      : `${this.config.baseUrl}/ape/api/pay`;

    const shopperResultUrl = `${this.config.apiBaseUrl}/thankyou/${reference}`;

    let payload: Record<string, unknown>;

    if (useCardToken && cardToken) {
      payload = {
        paymentSplit: [
          {
            cardToken,
            amount,
            paymentType: 'MOTO',
          },
        ],
        basket: {
          usingBasketDetails: {
            items,
            merchanOrderNumber: reference, // FNB API typo
          },
        },
      };
    } else {
      payload = {
        paymentDTO: {
          paymentSplit: [],
          callbackURL: shopperResultUrl,
          basket: {
            usingBasketDetails: {
              items,
              merchanOrderNumber: reference,
            },
          },
          storeCardInVault: true,
        },
        storeCardInVault: false,
        ttl: 120000,
      };
    }

    try {
      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      // Handle redirect responses (301, 302, 308) - FNB returns redirect URL
      if ([301, 302, 308].includes(response.status)) {
        const redirectUrl = response.headers['content-location'];
        if (!redirectUrl) {
          throw new Error('No redirect URL (Content-Location) in FNB response');
        }
        return redirectUrl;
      }

      // For tokenized payments, extract payment token from Location header
      if (useCardToken && cardToken) {
        const paymentToken = response.headers['location'];
        if (!paymentToken) {
          throw new Error('No payment token (Location) in FNB response');
        }
        return paymentToken;
      }

      return String(response.data ?? response.statusText);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status) {
        const status = err.response.status;
        if ([301, 302, 308].includes(status)) {
          const redirectUrl = err.response.headers['content-location'];
          if (redirectUrl) return redirectUrl;
        }
      }
      throw err;
    }
  }
}
