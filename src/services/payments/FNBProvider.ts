/**
 * FNB Payment Provider
 *
 * Implements BasePaymentProvider for FNB 3D Secure flow per examples/FNBService.ts.
 * Uses API-KEY, INST-KEY headers; paymentDTO/basket structure; Content-Location for redirect.
 */

import axios from 'axios';
import {
  BasePaymentProvider,
  PaymentProviderConfig,
  PaymentProviderType,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  WebhookPayload,
  WebhookValidationResult,
  PingResponse,
} from './BasePaymentProvider';

export class FNBProvider implements BasePaymentProvider {
  private config: PaymentProviderConfig;

  constructor(config: PaymentProviderConfig) {
    this.config = config;
  }

  getProviderType(): PaymentProviderType {
    return 'fnb_pay';
  }

  private getFnbConfig() {
    const meta = this.config.metadata || {};
    // Use only provider metadata - no .env fallback
    const baseUrl = meta.fnb_base_url?.trim();
    const apiKey3d = meta.fnb_api_key_3d?.trim() || this.config.apiKey?.trim();
    const apiInst3d = meta.fnb_api_inst_3d?.trim();
    const apiKey = meta.fnb_api_key?.trim();
    const apiInst = meta.fnb_api_inst?.trim();
    const secretKey = meta.fnb_secret_key?.trim() || undefined;
    const apiBaseUrl = (() => {
      const r = this.config.returnUrl?.trim();
      if (r) {
        try {
          const u = new URL(r);
          return u.origin;
        } catch { return r; }
      }
      return '';
    })();
    return { baseUrl, apiKey3d, apiInst3d, apiKey, apiInst, secretKey, apiBaseUrl };
  }

  async ping(): Promise<PingResponse> {
    const { baseUrl, apiKey3d, apiInst3d } = this.getFnbConfig();
    if (!apiKey3d || !apiInst3d) {
      return { success: false, error: 'Missing API Key 3D or Inst 3D. Add in provider settings.' };
    }
    if (!baseUrl) {
      return { success: false, error: 'Missing FNB Base URL. Add FNB Base URL in provider settings.' };
    }
    return { success: true, message: 'FNB credentials configured. Connection test not available.' };
  }

  async initiatePayment(request: InitiatePaymentRequest, transactionId: string): Promise<InitiatePaymentResponse> {
    const { baseUrl, apiKey3d, apiInst3d, apiKey, apiInst, secretKey, apiBaseUrl } = this.getFnbConfig();

    // Prefer fnb_api_key_3d + fnb_api_inst_3d (3D Secure); fallback to fnb_api_key + fnb_api_inst (MOTO)
    const apiKeyToUse = apiKey3d || apiKey;
    const apiInstToUse = apiInst3d || apiInst;

    if (!apiKeyToUse || !apiInstToUse) {
      return {
        success: false,
        transactionId,
        paymentUrl: '',
        error: 'Missing API Key 3D/Inst 3D or API Key/Inst. Configure in provider settings.',
      };
    }

    if (!baseUrl) {
      return {
        success: false,
        transactionId,
        paymentUrl: '',
        error: 'Missing FNB Base URL. Add FNB Base URL in provider settings.',
      };
    }

    const reference = transactionId.startsWith('fnb-') ? transactionId : `fnb-${transactionId}`;
    const callbackURL = request.returnUrl || this.config.returnUrl || (apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, '')}/thankyou/${reference}` : '');
    // Amount in rands (request.amount) converted to cents for FNB per examples/FNBService.ts
    const amountCents = Math.round(request.amount * 100);
    const items = [{ description: request.itemName, amount: amountCents }];

    const url = `${baseUrl.replace(/\/$/, '')}/ape/api/pay`;

    // Request format per examples/FNBService.ts: paymentDTO with basket.usingBasketDetails
    const payload = {
      paymentDTO: {
        paymentSplit: [],
        callbackURL,
        basket: {
          usingBasketDetails: {
            items,
            merchanOrderNumber: reference, // FNB API typo (merchan not merchant)
          },
        },
        storeCardInVault: true,
      },
      storeCardInVault: false,
      ttl: 120000,
    };

    // Headers per examples/FNBService.ts: API-KEY, INST-KEY (not X-Api-Key)
    const headers: Record<string, string> = {
      'API-KEY': apiKeyToUse,
      'INST-KEY': apiInstToUse,
      'Content-Type': 'application/json',
    };
    if (secretKey) headers['SECRET-KEY'] = secretKey;

    try {
      const response = await axios.post(url, payload, {
        headers,
        timeout: 15000,
        maxRedirects: 0, // FNB returns 301/302/308 with Content-Location - we don't follow
        validateStatus: () => true, // Don't throw on redirect; we handle 3xx manually
      });

      // FNB returns 301/302/308 with Content-Location header for redirect URL (per examples/FNBService.ts)
      if ([301, 302, 308].includes(response.status)) {
        const redirectUrl = response.headers['content-location'];
        if (redirectUrl) {
          return {
            success: true,
            transactionId,
            paymentUrl: redirectUrl,
            paymentData: { reference },
          };
        }
      }

      // Fallback: check for URL in JSON body
      if (response.status >= 200 && response.status < 300) {
        const data = response.data;
        const redirectUrl = typeof data?.url === 'string' ? data.url : data?.redirectUrl ?? data?.paymentUrl ?? response.headers['content-location'];
        if (redirectUrl) {
          return {
            success: true,
            transactionId,
            paymentUrl: redirectUrl,
            paymentData: { reference },
          };
        }
      }

      if ([301, 302, 308].includes(response.status) && !response.headers['content-location']) {
        return {
          success: false,
          transactionId,
          paymentUrl: '',
          error: 'FNB response missing redirect URL (Content-Location header).',
        };
      }

      const data = response.data;
      const errMsg = typeof data === 'object'
        ? (data?.message ?? data?.error ?? data?.errors ?? JSON.stringify(data))
        : String(data);
      const fullError = `FNB API: Bad Request (${response.status}). Response: ${errMsg}`;

      return {
        success: false,
        transactionId,
        paymentUrl: '',
        error: fullError,
      };
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? 'Unknown FNB error';
      return {
        success: false,
        transactionId,
        paymentUrl: '',
        error: `FNB request failed: ${message}`,
      };
    }
  }

  async validateWebhook(payload: WebhookPayload): Promise<WebhookValidationResult> {
    return {
      valid: false,
      error: 'FNB webhook validation not implemented. Implement per FNB merchant docs.',
    };
  }
}
