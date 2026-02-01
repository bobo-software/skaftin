import * as crypto from 'crypto';
import { Request, Response } from 'express';
import ResponseUtils from '../utils/ResponseUtils';
import { db } from '../db/drizzle.config';
import CommonUtils from '../utils/CommonUtils';
import { eq, and, like, gte, inArray } from 'drizzle-orm';
import { payments } from '../db/schemas/PaymentsSchema';
import { FNBService } from './FNBService';
import axios from 'axios';

export default class PaymentsController {

  /**
   * FNB Payment - 3D Secure redirect flow. User is redirected to FNB to complete payment.
   * Request body:
   * - description: string - payment description
   * - amount: number - amount in currency units (converted to cents for FNB)
   */
  static async handleFNBPayment(req: Request, res: Response) {
    try {
      const decodedToken = CommonUtils.handleAuthHeader(req);
      if (decodedToken instanceof Response) {
        return ResponseUtils.error(res, 'Unauthorized', {}, req.body, 401);
      }
      const userId = (decodedToken as { id: number }).id;

      const { description, amount: amountRaw } = req.body;

      if (!description || typeof description !== 'string') {
        return ResponseUtils.error(res, 'description (string) is required', {}, req.body, 400);
      }
      const amountCents = Math.round(parseFloat(String(amountRaw)) * 100);
      if (isNaN(amountCents) || amountCents <= 0) {
        return ResponseUtils.error(res, 'amount must be a positive number', {}, req.body, 400);
      }

      const merchantTransactionId = `fnb-${crypto.randomUUID()}`;
      const items = [{ description, amount: amountCents }];

      // Check pending payments (last 5 minutes)
      const date5MinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const pending = await db
        .select({ status: payments.status })
        .from(payments)
        .where(
          and(
            eq(payments.user_id, userId),
            like(payments.gateway, '%fnb_pay%'),
            gte(payments.timestamp, date5MinsAgo),
            inArray(payments.status, ['pending', 'Busy', 'paid'])
          )
        );
      if (pending.length > 0) {
        return ResponseUtils.error(
          res,
          'A payment is already pending or was recently completed. Please wait before retrying.',
          {},
          req.body,
          409
        );
      }

      const fnb = new FNBService(false);
      const paymentResponse = await fnb.processPayment(
        null,
        items,
        amountCents,
        merchantTransactionId,
        false
      );

      return ResponseUtils.success(res, 'Redirect to complete payment', {
        url: paymentResponse,
        reference: merchantTransactionId,
      });
    } catch (error) {
      console.error('FNB Payment Error:', error);
      return ResponseUtils.error(res, 'FNB payment failed', error, req.body, 500);
    }
  }

  static async handlePayfastPayment(req: Request, res: Response) {

    const { name, email, payment_id, amount, item_name, description } = req.body

    const merchantId = 20492846;
    const merchantKey = 'wrxnyb9xpt1sq';
    const passphrase = 'BLUmoshate_2024';

    const paymentData: any = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: 'https://yourapp.com/return',
      cancel_url: 'https://yourapp.com/cancel',
      notify_url: 'https://yourapp.com/notify',
      name_first: name,
      email_address: email,
      m_payment_id: payment_id,
      amount: amount,
      item_name: item_name,
      item_description: description,
    };

    // Function to generate signature
    function generateSignature(data: any, passphrase: string): string {
      const signatureString = Object.keys(data)
        .filter(key => key !== 'signature')
        .sort()
        .map(key => `${key}=${encodeURIComponent(data[key])}`)
        .join('&');

      return crypto
        .createHash('md5')
        .update(signatureString + `&passphrase=${encodeURIComponent(passphrase)}`)
        .digest('hex');
    }

    // Generate signature
    const signature: any = generateSignature(paymentData, passphrase);
    paymentData['signature'] = signature;

    // Redirect to PayFast
    res.status(200).json({
      url: 'https://www.payfast.co.za/eng/process?' + new URLSearchParams(paymentData),
    });
  }

  static async mobilePayments(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (decodedToken instanceof Response) {
      return ResponseUtils.error(res, "Unauthorized", decodedToken);
    };
    try {

      const payment = await db
        .select()
        .from(payments)
        .where(eq(payments.user_id, decodedToken.id));

      ResponseUtils.success(res, "Mobile Payments", payment);
    } catch (error) {
      ResponseUtils.error(res, "Error fetching mobile payments", error);
    }
  };

  static async purchaseVoucher(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (decodedToken instanceof Response) {
      return ResponseUtils.error(res, "Unauthorized", decodedToken);
    };

    const { product_id, delivery, quantity, type, phone, email, walletDeduction, totalPrice, commission } = req.body;

    try {
      const response = await axios.post(`https://slipsamtest.accuat.mulelu.co.za/api/payments/product_payment`, {
        "apply_credit": type === "wallet" ? true : false,
        "delivery": delivery,
        "phone": phone,
        "email": email,
        "user_id": decodedToken.id,
        "walletDeduction": walletDeduction,
        "totalPrice": totalPrice,
        "commission": commission,
        "method": "",
        "product_id": product_id,
        "quantity": parseInt(quantity),
        "type": type
      }, {
        headers: {
          'Authorization': `${req.headers.authorization}`
        }
      });

      ResponseUtils.success(res, "Voucher purchased successfully", response.data);

    } catch (error) {
      ResponseUtils.error(res, "Error purchasing voucher", error);
    }

  }

}
