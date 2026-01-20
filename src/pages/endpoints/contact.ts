import type { APIContext, APIRoute, AstroSession } from "astro";
import SmsClient from "@lib/SmsGatewayClient.ts";
import Otp, { verifyOtp } from "@lib/Otp.ts";
import CapServer from "@lib/CapAdapter";
import * as ContactForm from "../../types/ContactForm";
import {
  OTP_SUPER_SECRET_SALT,
  ANDROID_SMS_GATEWAY_RECIPIENT_PHONE,
} from "astro:env/server";
export const prerender = false;

const OTP_SALT = OTP_SUPER_SECRET_SALT;
if (!OTP_SALT) {
  throw new Error("OTP secret salt configuration is missing.");
}

async function sendOtp(
  phone: string | undefined,
): Promise<ContactForm.SendSMSResult> {
  if (!phone) {
    return {
      success: false,
      error: "Phone number is required.",
    };
  }

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
      error: "Verification code failed to send.",
    };
  }
}

async function sendMsg(
  name: string | undefined,
  phone: string | undefined,
  otp: string | undefined,
  msg: string | undefined,
): Promise<ContactForm.SendSMSResult> {
  if (!name || !phone || !otp || !msg) {
    return {
      success: false,
      error: "SendMsg: Missing required fields",
    };
  }

  const message = `Web message from ${name} ( ${phone} ):\n\n"${msg}"`;

  const isVerified = verifyOtp(phone, OTP_SALT, otp);
  if (!isVerified) {
    return {
      success: false,
      error: "Invalid or expired verification code.",
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
    error: "Message failed to send.",
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

async function validateFields<K extends ContactForm.FieldKey>(
  unsafe: ContactForm.Fields<K>,
): Promise<ContactForm.Fields<K>> {
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
      case "otp": {
        if (!sixDigitsOnlyRegex.test(value)) {
          error = "OTP code invalid.";
          break;
        }
        break;
      }
      case "captcha": {
        const capValidation = await CapServer.validateToken(value);
        if (!capValidation.success) {
          error = "Invalid captcha token.";
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

export function generateInitialState(error?: string): ContactForm.State {
  return (
    !error
      ? {
          state: "initial",
          fields: {},
          hasError: false,
        }
      : {
          state: "initial",
          fields: {},
          error,
          hasError: true,
        }
  ) as ContactForm.State;
}

const respondWithState = (state: ContactForm.State) =>
  new Response(JSON.stringify(state), {
    status: state.hasError ? 400 : 200,
  });

export const POST: APIRoute = async (Astro: APIContext) => {
  try {
    const initialState = await processRequestIntoState(Astro);
    if (initialState.hasError) {
      return respondWithState(initialState);
    }

    const validatedState = await validateState(initialState);
    if (validatedState.hasError) {
      return respondWithState(validatedState);
    }

    const finalState = await runStateAction(validatedState, Astro);
    return respondWithState(finalState);
  } catch (error) {
    const message =
      error instanceof Error
        ? "Unexpected POST error: " + error.message
        : "Unexpected POST error.";

    return respondWithState(generateInitialState(message));
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

    const action = await data.get("action");

    if (!action) {
      throw "Invalid action";
    }

    //TODO: session.get returns undefined always
    if (action == "send_otp" || action == "send_msg") {
      fields.name = {
        hasError: false,
        value: await (action === "send_msg"
          ? session.get("name")
          : data.get("name")),
      };
      fields.phone = {
        hasError: false,
        value: await (action === "send_msg"
          ? session.get("phone")
          : data.get("phone")),
      };
      fields.msg = {
        hasError: false,
        value: await (action === "send_msg"
          ? session.get("msg")
          : data.get("msg")),
      };
      fields.captcha = {
        hasError: false,
        value: await data.get("cap-token"),
      };
      if (action === "send_msg") {
        fields.otp = {
          hasError: false,
          value: await data.get("otp"),
        };
      }
    }

    return {
      state: action,
      fields,
      hasError: false,
    };
  } catch (error) {
    return {
      state: "initial",
      fields: {},
      hasError: true,
      error:
        error instanceof Error
          ? "Unexpected processRequest error: " + error.message
          : "Unexpected processRequest error.",
    };
  }
}

function nextState(state: ContactForm.State): ContactForm.State {
  if (state.hasError) {
    return state;
  }

  let next = {
    state: "initial",
    fields: {},
    hasError: false,
  };
  switch (state.state) {
    case "send_otp":
      next.state = "otp_sent";
      break;
    case "send_msg":
      next.state = "complete";
      break;
  }
  return next as ContactForm.State;
}

function prevState(state: ContactForm.State): ContactForm.State {
  let next = {
    state: "initial",
    fields: {},
    hasError: state.hasError,
  };
  switch (state.state) {
    case "send_otp":
      next.state = "initial";
      break;
    case "send_msg":
      next.state = "otp_sent";
      break;
  }
  return next as ContactForm.State;
}

export async function validateState(
  state: ContactForm.State,
): Promise<ContactForm.State> {
  try {
    state.fields = await validateFields(state.fields);
    // if state.fields has any errors, set hasError on state too and set a message
    return state;
  } catch (error) {
    return {
      state: "initial",
      fields: {},
      hasError: true,
      error:
        error instanceof Error
          ? "Unexpected validateState error: " + error.message
          : "Unexpected validateState error.",
    };
  }
}

export async function runStateAction(
  state: ContactForm.State,
  Astro: APIContext,
): Promise<ContactForm.State> {
  const { session } = Astro;

  try {
    if (state.state === "send_otp" || state.state === "send_msg") {
      const name = state.fields.name.value;
      const phone = state.fields.phone.value;
      const msg = state.fields.msg.value;
      const otp =
        state.state === "send_msg" ? state.fields.otp.value : undefined;

      let result;
      switch (state.state) {
        case "send_otp":
          result = await sendOtp(phone);
          if (result.success) {
            session?.set("name", name);
            session?.set("phone", phone);
            session?.set("msg", msg);
          }
          break;
        case "send_msg":
          result = await sendMsg(name, phone, msg, otp);
          if (result.success) {
            session?.delete("name");
            session?.delete("phone");
            session?.delete("msg");
          }
          break;
      }
      if (!result.success) {
        state.hasError = true;
        state.error = result.error;
        state = prevState(state);
      } else {
        state = nextState(state);
      }
    } else {
      return generateInitialState("Invalid action.");
    }
    return state;
  } catch (error) {
    return {
      state: "initial",
      fields: {},
      hasError: true,
      error:
        error instanceof Error
          ? "Unexpected runAction error: " + error.message
          : "Unexpected runAction error.",
    };
  }
}
