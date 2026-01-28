/**
 * EXAMPLE FILE - Reference implementation from previous project
 * This file is kept as documentation for PayFast integration patterns.
 * The actual implementation is in src/services/payments/PayFastProvider.ts
 */

import { Request, Response } from "express";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";
import dns from "dns";
import * as querystring from "querystring";

dotenv.config();

// Placeholder types for example code
type PaymentRecord = { id: number; status: string; made: number; time: string };
const payments = { id: null as any };
const db = { update: (_: any) => ({ set: (_: any) => ({ where: (_: any) => Promise.resolve() }) }) };
const eq = (a: any, b: any) => true;

const testingMode = process.env.TESTING_MODE === "true";
const pfHost = testingMode ? "sandbox.payfast.co.za" : "www.payfast.co.za";
const passPhrase = process.env.PAYFAST_PASSPHRASE ?? "";

interface PayFastHeaders {
  "merchant-id": string;
  version: string;
  timestamp: string;
  signature?: string;
  [key: string]: string | undefined;
}

class PayfastController {
  private async ipLookup(domain: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      dns.lookup(domain, { all: true }, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses.map((item) => item.address));
      });
    });
  }

  private async pfValidIP(req: Request): Promise<boolean> {
    const validHosts = [
      "www.payfast.co.za",
      "sandbox.payfast.co.za",
      "w1w.payfast.co.za",
      "w2w.payfast.co.za",
    ];
    const pfIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const validIps = await Promise.all(validHosts.map(this.ipLookup)).then((results) => results.flat());

    return validIps.includes(pfIp as string);
  }

  private pfValidSignature(
    pfData: Record<string, any>,
    pfParamString: string,
    pfPassphrase: string
  ): boolean {
    const fullParamString = pfPassphrase
      ? `${pfParamString}&passphrase=${encodeURIComponent(pfPassphrase)}`
      : pfParamString;

    const generatedSignature = crypto.createHash("md5").update(fullParamString).digest("hex");
    return pfData["signature"] === generatedSignature;
  }

  private pfValidPaymentData(cartTotal: string, pfData: Record<string, any>): boolean {
    return Math.abs(parseFloat(cartTotal) - parseFloat(pfData["amount_gross"])) <= 0.01;
  }

  private async pfValidServerConfirmation(pfHost: string, pfParamString: string): Promise<boolean> {
    try {
      const response = await axios.post(`https://${pfHost}/eng/query/validate`, pfParamString);
      return response.data === "VALID";
    } catch (error) {
      console.error("Server confirmation failed:", error);
      return false;
    }
  }

  public async Notify(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      const parsedData = new URLSearchParams(payload);
      const pfData = Object.fromEntries(parsedData.entries());

      const pfParamString = Object.entries(pfData)
        .filter(([key]) => key !== "signature")
        .map(([key, value]) => `${key}=${encodeURIComponent(value.trim())}`)
        .join("&");

      const cartTotal = pfData["amount_gross"];
      const validSignature = this.pfValidSignature(pfData, pfParamString, passPhrase);
      const validIP = await this.pfValidIP(req);
      const validPaymentData = this.pfValidPaymentData(cartTotal, pfData);
      const validServerConfirmation = await this.pfValidServerConfirmation(pfHost, pfParamString);

      if (!(validSignature && validIP && validPaymentData && validServerConfirmation)) {
        console.error("Payment validation failed.");
        res.status(400).send("Payment validation failed.");
        return;
      }

      await db
        .update(payments)
        .set({
          status: "Paid",
          made: parseFloat(pfData["amount_gross"]),
          time: new Date().toISOString(),
        })
        .where(eq(payments.id, parseInt(pfData["custom_str2"])));

      res.status(200).send("OK");
    } catch (error) {
      console.error("Error processing payment notification:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  public async PingPayfast(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = "20492846";
      const version = "v1";
      const salt = "BLUmoshate_2024";

      const generateApiSignature = (data: Record<string, any>, passPhrase: string): string => {
        const payload = Object.entries({ ...data, passphrase: passPhrase })
          .filter(([key]) => key !== "signature")
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([key, value]) => `${key}=${querystring.escape(String(value))}`)
          .join("&");

        return crypto.createHash("md5").update(payload).digest("hex");
      };

      const timestamp = new Date().toISOString();
      const headers: PayFastHeaders = {
        "merchant-id": merchantId,
        version,
        timestamp,
      };

      headers["signature"] = generateApiSignature(headers, salt);

      const response = await axios.get("https://api.payfast.co.za/ping", { headers });
      res.status(200).json(response.data);
    } catch (error: any) {
      console.error("Error fetching payment details:", error.message);
      res.status(500).send("Internal Server Error");
    }
  };

  public async GetRecentPayments(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = "20492846";
      const version = "v1";
      const salt = "BLUmoshate_2024";

      const generateApiSignature = (data: Record<string, any>, passPhrase: string): string => {
        const payload = Object.entries({ ...data, passphrase: passPhrase })
          .filter(([key]) => key !== "signature")
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([key, value]) => `${key}=${querystring.escape(String(value))}`)
          .join("&");

        return crypto.createHash("md5").update(payload).digest("hex");
      };

      const timestamp = new Date().toISOString().split('.')[0];
      const headers: PayFastHeaders = {
        "merchant-id": merchantId,
        version,
        timestamp,
      };

      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const startDate = thirtyDaysAgo.toISOString().split("T")[0]; // Format as YYYY-MM-DD
      const endDate = today.toISOString().split("T")[0];

      headers["signature"] = generateApiSignature(headers, salt);

      const response = await axios.get("https://api.payfast.co.za/transactions/history", { headers });
      res.status(200).json(response.data);
    } catch (error: any) {
      console.error("Error fetching payment details:", error.message);
      res.status(500).send("Internal Server Error: " + error.message);
    }
  };




}

export default new PayfastController();