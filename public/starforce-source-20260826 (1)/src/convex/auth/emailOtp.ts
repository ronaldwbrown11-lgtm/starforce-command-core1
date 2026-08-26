"use node";

import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

const SITE_URL = process.env.SITE_URL ?? "https://starforcebase1198.com";
const FROM =
  process.env.EMAIL_FROM ?? "Star Force 1198 <no-reply@starforcebase1198.com>";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Email OTP is not configured. Add RESEND_API_KEY.");
    }

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: FROM,
      to: email,
      subject: "Your Star Force 1198 access code",
      text: `Your Star Force 1198 access code is ${token}. It expires in 15 minutes.\n\n${SITE_URL}`,
      html: `<!doctype html><html><body style="margin:0;background:#0A0A0C;color:#F5F9FF;font-family:Arial,sans-serif;padding:32px 16px"><div style="max-width:520px;margin:auto;border:1px solid #1E2430;border-radius:12px;background:#111214;padding:28px"><p style="color:#00E5FF;letter-spacing:.18em;text-transform:uppercase;font-size:12px">Star Force 1198</p><h1 style="font-size:24px">Your access code</h1><p style="color:#B7C3D0">Enter this code to authenticate with Star Force Base 1198:</p><p style="font-size:36px;letter-spacing:.28em;font-weight:700;color:#00E5FF;margin:24px 0">${token}</p><p style="color:#7A8794;font-size:13px">This code expires in 15 minutes. If you did not request it, you can ignore this message.</p></div></body></html>`,
    });

    if (result.error) {
      throw new Error(`Resend OTP delivery failed: ${result.error.message}`);
    }
  },
});
