import type { APIContext, APIRoute, AstroGlobal } from "astro";
import SmsClient from "@lib/SmsGatewayClient.ts";
import Otp, { verifyOtp } from "@lib/Otp.ts";
import CapServer from "@lib/CapAdapter";
import * as ContactForm from "../../types/ContactForm";
import {
  OTP_SUPER_SECRET_SALT,
  ANDROID_SMS_GATEWAY_RECIPIENT_PHONE,
} from "astro:env/server";
import type { defaultSettings } from "astro/runtime/client/dev-toolbar/settings.js";
export const prerender = false;

const OTP_SALT = OTP_SUPER_SECRET_SALT;
if (!OTP_SALT) {
  throw new Error("OTP secret salt configuration is missing.");
}

async function sendOtp({
  phone,
}: ContactFormOtpPayload): Promise<SendSMSResult> {
  const otp = Otp.generateOtp(phone, OTP_SALT);
  const stepSeconds = Otp.getOtpStep();
  const stepMinutes = Math.floor(stepSeconds / 60);
  const remainingSeconds = stepSeconds % 60;

  const api = new SmsClient();
  const message = `${otp} is your verification code. This code is valid for ${stepMinutes}m${remainingSeconds}s.`;
  const result = await api.sendSMS(phone, message);

  if (result.success) {
    Otp.recordOtpRequest(phone);

    return {
      success: true,
      expiresInSeconds: stepSeconds,
    };
  } else {
    return {
      success: false,
      errors: { form: "Verification code failed to send." },
    };
  }
}

async function sendMsg({
  name,
  phone,
  code,
  msg,
}: ContactFormMsgPayload): Promise<SendSMSResult> {
  const message = `Web message from ${name} ( ${phone} ):\n\n"${msg}"`;

  const isVerified = verifyOtp(phone, OTP_SALT, code);
  if (!isVerified) {
    return {
      success: false,
      errors: { code: "Invalid or expired verification code." },
    };
  }

  const smsClient = new SmsClient();
  const result = await smsClient.sendSMS(
    ANDROID_SMS_GATEWAY_RECIPIENT_PHONE,
    message,
  );

  if (result.success) {
    Otp.recordMsgSubmission(phone);
    return {
      success: true,
    };
  }

  return {
    success: false,
    errors: { form: "Message failed to send." },
  };
}

export const ALL: APIRoute = () => {
  return new Response(
    JSON.stringify({
      success: false,
      message: "Invalid HTTP method.",
      field: "form",
    }),
    { status: 400 },
  );
};

function validateFields<K extends ContactForm.FieldKey>(
  unsafe: ContactForm.Fields<K>,
): ContactForm.Fields<K> {
  const fields: Partial<ContactForm.Fields<K>> = {};
  const printableAsciiRegex = /^[\x20-\x7E\n\r]*$/;
  const sixDigitsOnlyRegex = /^[0-9]{6}$/;
  const excessiveRepeatedCharactersRegex = /([a-zA-Z])\1{4,}/;

  for (const field of Object.keys(unsafe) as K[]) {
    let { value, error } = unsafe[field];

    if (!value) {
      fields[field] = {
        hasError: true,
        error: "Field is required.",
      };
      continue;
    }

    switch (field) {
      case "phone": {
        const result = Otp.validatePhoneNumber(value);
        if (
          !result.success ||
          typeof result.validatedPhoneNumber !== "string"
        ) {
          error = "Invalid phone number.";
          break;
        }
        if (Otp.isRateLimitedForOtp(value)) {
          error = "Too many OTP requests. Please try again later.";
          break;
        }

        if (Otp.isRateLimitedForMsgs(value)) {
          error = "Too many messages. Please try again later.";
          break;
        }
        value = result.validatedPhoneNumber;
        break;
      }
      case "name": {
        if (!printableAsciiRegex.test(value)) {
          error = "Name contains non-ASCII or non-printable characters.";
          break;
        }
        if (value.length < 2 || value.length > 25) {
          error = "Name must be between 2 and 25 characters.";
          break;
        }
        break;
      }
      case "msg": {
        if (!printableAsciiRegex.test(value)) {
          error = "Message contains non-ASCII or non-printable characters.";
          break;
        }
        if (value.length > 500) {
          error = "Message cannot be longer than 500 characters.";
          break;
        }
        if (value.length < 20) {
          error = "Message is too short.";
          break;
        }
        if (excessiveRepeatedCharactersRegex.test(value)) {
          error = "Message contains excessive repeated characters.";
          break;
        }

        const uppercaseRatio =
          (value.match(/[A-Z]/g) || []).length / value.length;
        if (uppercaseRatio > 0.25) {
          error = "Message contains excessive uppercase text.";
          break;
        }
        break;
      }
      case "code": {
        if (!sixDigitsOnlyRegex.test(value)) {
          error = "OTP code invalid.";
          break;
        }
        break;
      }
    }

    if (error) {
      fields[field] = { hasError: true, error };
    } else {
      fields[field] = { hasError: false, value };
    }
  }

  return fields as ContactForm.Fields<K>;
}

const isValidState = (value: unknown): value is ContactForm.State => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ContactForm.State>;
  return (
    typeof candidate.state === "string" &&
    (typeof candidate.fields === "object" ||
      typeof candidate.fields === "undefined") &&
    (typeof candidate.error === "string" ||
      typeof candidate.error === "undefined") &&
    typeof candidate.hasError === "boolean"
  );
};

export const POST: APIRoute = async (Astro) => {
  const respondWithState = (state: ContactForm.State) =>
    new Response(JSON.stringify(state), {
      status: state.hasError ? 400 : 200,
    });
  try {
    const initialState = await processRequestIntoState(Astro);
    if (initialState.hasError) {
      return respondWithState(initialState);
    }

    const validatedState = await validateState(initialState);
    if (validatedState.hasError) {
      return respondWithState(validatedState);
    }

    const finalState = await runStateAction(validatedState);
    return respondWithState(finalState);
  } catch (caught) {
    if (isValidState(caught)) {
      return respondWithState(caught);
    }

    const message =
      caught instanceof Error
        ? caught.message
        : String(caught ?? "Unexpected error");

    return respondWithState({
      state: "initial",
      fields: {},
      hasError: true,
      error: message,
    });
  }
};

export async function processRequestIntoState(
  Astro: APIContext,
): Promise<ContactForm.State> {
  const fields: Partial<ContactForm.Fields<ContactForm.FieldKey>> = {};
  try {
    const { request, session } = Astro;
    if (!request) {
      throw "Request is undefined.";
    }
    if (!session) {
      throw "Session is undefined.";
    }
    const contentType = request.headers.get("Content-Type");
    if (
      contentType !== "application/json" &&
      contentType !== "application/x-www-form-urlencoded"
    ) {
      throw "Invalid Content-Type.";
    }
    const data =
      contentType === "application/json"
        ? await request.json()
        : await request.formData();

    if (!data) {
      throw "Data is undefined.";
    }

    const action = await data.get("action")?.toString();

    if (!action) {
      throw "Invalid action";
    }

    fields.name = {
      hasError: false,
      value:
        action === "send_msg"
          ? session.get("name")?.toString()
          : await data.get("name")?.toString(),
    };
    fields.phone = {
      hasError: false,
      value:
        action === "send_msg"
          ? session.get("phone")?.toString()
          : await data.get("phone")?.toString(),
    };
    fields.msg = {
      hasError: false,
      value:
        action === "send_msg"
          ? session.get("msg")?.toString()
          : await data.get("msg")?.toString(),
    };
    fields.captcha = {
      hasError: false,
      value: data.get("cap-token")?.toString(),
    };
    fields.code = { hasError: false, value: data.get("code")?.toString() };

    return {
      state: action,
      fields,
      hasError: false,
    };
  } catch (error) {
    return {
      state: "initial",
      fields,
      hasError: true,
      error: error instanceof Error ? error.message : "Unknown error.",
    };
  }
}

export async function validateState(
  state: ContactForm.State,
): Promise<ContactForm.State> {
  state.fields = validateFields(state.fields);
  // if state.fields has any errors, set hasError on state too and set a message
  return state;
}

export async function runStateAction(
  state: ContactForm.State,
): Promise<ContactForm.State> {
  //Todo
  return state;
}
