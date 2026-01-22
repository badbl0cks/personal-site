import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import type { ActionAPIContext } from "astro:actions";
import validator from "validator";
import SmsClient from "@lib/SmsGatewayClient.ts";
import Otp, { verifyOtp } from "@lib/Otp.ts";
import CapServer from "@lib/CapAdapter";
import {
  OTP_SUPER_SECRET_SALT,
  ANDROID_SMS_GATEWAY_RECIPIENT_PHONE,
} from "astro:env/server";

const isValidCaptcha: [(data: string) => any, { message: string }] = [
  async (value: string) =>
    typeof console.log(value) &&
    /^[a-fA-F0-9]{16}:[a-fA-F0-9]{30}$/.test(value) &&
    (await CapServer.validateToken(value)),
  {
    message: "Invalid captcha token.",
  },
];

const stripLow = (value: string) => validator.stripLow(value);

const isMobilePhone: [(data: string) => any, { message: string }] = [
  (value: string) => validator.isMobilePhone(value, ["en-US", "en-CA"]),
  { message: "Invalid phone number" },
];

const noYelling: [(data: string) => any, { message: string }] = [
  (value: string) =>
    (value.match(/\p{Uppercase_Letter}/gv) || []).length / value.length < 0.1,
  { message: "No yelling!" },
];

const noExcessiveRepetitions: [(data: string) => any, { message: string }] = [
  (value: string) => !/(.)\1{2,}/.test(value),
  { message: "No excessive repetitions!" },
];

const acceptableText: [(data: string) => any, { message: string }] = [
  (value: string) =>
    /^[\p{Letter}\p{Mark}\p{General_Category=Decimal_Number}\p{General_Category=Punctuation}\p{General_Category=Space_Separator}\p{General_Category=Symbol}\p{RGI_Emoji}]*$/v.test(
      value,
    ),
  {
    message:
      "Only letters, numbers, punctuation, spaces, symbols, and emojis are allowed.",
  },
];

const captcha_input = z
  .string()
  .trim()
  .nonempty()
  .refine(...isValidCaptcha);

const sendOtpAction = z.object({
  action: z.literal("send_otp"),
  name: z
    .string()
    .trim()
    .min(5)
    .max(32)
    .transform(stripLow)
    .refine(...acceptableText),
  phone: z
    .string()
    .trim()
    .refine(...isMobilePhone),
  msg: z
    .string()
    .trim()
    .min(25)
    .max(512)
    .transform(stripLow)
    .refine(...noYelling)
    .refine(...noExcessiveRepetitions)
    .refine(...acceptableText),
  captcha: captcha_input,
});

const sendMsgAction = z.object({
  action: z.literal("send_msg"),
  otp: z.string().trim().length(6),
  captcha: captcha_input,
});

const formAction = z.discriminatedUnion("action", [
  sendOtpAction,
  sendMsgAction,
]);

const submitActionDefinition = {
  input: formAction,
  handler: async (input: any, context: ActionAPIContext) => {
    if (!OTP_SUPER_SECRET_SALT || !ANDROID_SMS_GATEWAY_RECIPIENT_PHONE) {
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Server variables are missing.",
      });
    }

    if (input.action === "send_otp") {
      const { name, phone, msg } = input;
      if (!phone || !Otp.validatePhoneNumber(phone)) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Invalid phone number.",
        });
      }

      if (Otp.isRateLimitedForOtp(phone)) {
        throw new ActionError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many OTP requests. Please try again later.",
        });
      }

      if (Otp.isRateLimitedForMsgs(phone)) {
        throw new ActionError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many message requests. Please try again later.",
        });
      }

      const otp = Otp.generateOtp(phone, OTP_SUPER_SECRET_SALT);
      const stepSeconds = Otp.getOtpStep();
      const stepMinutes = Math.floor(stepSeconds / 60);
      const remainingSeconds = stepSeconds % 60;

      const api = new SmsClient();
      const message = `${otp} is your verification code. This code is valid for ${stepMinutes} minutes${
        remainingSeconds != 0 ? " " + remainingSeconds + " seconds." : "."
      }`;
      const result = await api.sendSMS(phone, message);

      if (result.success) {
        Otp.recordOtpRequest(phone);

        context.session?.set("phone", phone);
        context.session?.set("name", name);
        context.session?.set("msg", msg);

        return {
          nextAction: "send_msg",
        };
      } else {
        throw new ActionError({
          code: "SERVICE_UNAVAILABLE",
          message: "Verification code failed to send. Please try again later.",
        });
      }
    } else if (input.action === "send_msg") {
      const { otp } = input;
      const name = await context.session?.get("name");
      const phone = await context.session?.get("phone");
      const msg = await context.session?.get("msg");

      if (!name || !otp || !msg || !phone) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Missing required fields.",
        });
      }

      const isVerified = verifyOtp(phone, OTP_SUPER_SECRET_SALT, otp);
      if (!isVerified) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Invalid or expired verification code.",
        });
      }

      const message = `Web message from ${name} ( ${phone} ):\n\n${msg}`;

      const smsClient = new SmsClient();
      const result = await smsClient.sendSMS(
        ANDROID_SMS_GATEWAY_RECIPIENT_PHONE,
        message,
      );

      if (result.success) {
        Otp.recordMsgSubmission(phone);

        context.session?.delete("phone");
        context.session?.delete("name");
        context.session?.delete("msg");

        return {
          nextAction: "complete",
        };
      }

      throw new ActionError({
        code: "SERVICE_UNAVAILABLE",
        message: "Message failed to send.",
      });
    }
  },
};

export const contact = {
  submitForm: defineAction({ ...submitActionDefinition, accept: "form" }),
  submitJson: defineAction({ ...submitActionDefinition, accept: "json" }),
};
