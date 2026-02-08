import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import type { ActionAPIContext } from "astro:actions";
import validator from "validator";
import SmsClient from "@lib/SmsGatewayClient.ts";
import Otp, { verifyOtp } from "@lib/Otp.ts";
import { createCap } from "@lib/CapAdapter";
import {
  OTP_SUPER_SECRET_SALT,
  ANDROID_SMS_GATEWAY_RECIPIENT_PHONE,
} from "astro:env/server";

const isValidMobilePhone: [(data: string) => any, { message: string }] = [
  (value: string) =>
    validator.isMobilePhone(value, ["en-US", "en-CA"]) &&
    Otp.isValidPhone(value),
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

const stripDisallowedCharacters = (value: string) =>
  value
    .match(
      /(?:[\p{Letter}\p{Mark}\p{General_Category=Decimal_Number}\p{General_Category=Punctuation}\p{General_Category=Space_Separator}\p{General_Category=Symbol}]|\p{RGI_Emoji})/gv,
    )
    ?.join("") ?? "";

const captcha_input = z.string().trim().nonempty();

const sendOtpAction = z.object({
  action: z.literal("send_otp"),
  name: z.string().trim().min(5).max(32).transform(stripDisallowedCharacters),
  phone: z
    .string()
    .trim()
    .refine(...isValidMobilePhone),
  msg: z
    .string()
    .trim()
    .min(25)
    .max(512)
    .transform(stripDisallowedCharacters)
    .refine(...noYelling)
    .refine(...noExcessiveRepetitions),
  captcha: captcha_input,
});

const sendMsgAction = z.object({
  action: z.literal("send_msg"),
  otp: z.string().trim().length(6),
  captcha: captcha_input,
});

const resetAction = z.object({
  action: z.literal("reset"),
});

const formAction = z.discriminatedUnion("action", [
  sendOtpAction,
  sendMsgAction,
  resetAction,
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

    const cap = createCap(context.session ?? null);

    if (
      !(
        /^[a-fA-F0-9]{16}:[a-fA-F0-9]{30}$/.test(input.captcha) &&
        (await cap.validateToken(input.captcha))
      )
    ) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Invalid Captcha Token.",
      });
    }

    if (input.action === "send_otp") {
      const { name, phone, msg } = input;

      const otp = Otp.generateOtp(phone, OTP_SUPER_SECRET_SALT);
      const stepSeconds = Otp.getOtpStep();
      const stepMinutes = Math.floor(stepSeconds / 60);
      const remainingSeconds = stepSeconds % 60;

      const message = `${otp} is your verification code. This code is valid for ${stepMinutes} minutes${
        remainingSeconds != 0 ? " " + remainingSeconds + " seconds." : "."
      }`;

      const result = await new SmsClient().sendSMS(phone, message);

      if (result.success) {
        context.session?.set("phone", phone);
        context.session?.set("name", name);
        context.session?.set("msg", msg);

        return {
          nextAction: "send_msg",
        };
      } else {
        throw new ActionError({
          code: "SERVICE_UNAVAILABLE",
          message: "Verification code failed to send: " + result.message,
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
        return {
          nextAction: "send_msg",
          error: "Invalid or expired verification code.",
          field: "otp",
        };
        // throw new ActionError({
        //   code: "BAD_REQUEST",
        //   message: "Invalid or expired verification code.",
        // });
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
      } else if (input.action === "reset") {
        context.session?.delete("phone");
        context.session?.delete("name");
        context.session?.delete("msg");

        return {
          nextAction: "send_otp",
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
