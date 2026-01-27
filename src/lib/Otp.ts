import { authenticator } from "otplib";
import { createHash } from "crypto";

const submissionTimestamps = new Map();
const otpRequestTimestamps = new Map();
const ONE_WEEK_IN_MS: number = 7 * 24 * 60 * 60 * 1000;
const ONE_HOUR_IN_MS: number = 60 * 60 * 1000;
const MAX_OTP_REQUESTS_PER_HOUR: number = 3;
const MAX_MESSAGES_PER_WEEK: number = 3;
const OTP_STEP_IN_SEC: number = 300;
const VALID_PAST_OTP_STEPS: number = 1;
const VALID_FUTURE_OTP_STEPS: number = 1;
const OTP_NUM_DIGITS: number = 6;

authenticator.options = {
  step: OTP_STEP_IN_SEC,
  window: [VALID_PAST_OTP_STEPS, VALID_FUTURE_OTP_STEPS],
  digits: OTP_NUM_DIGITS,
};

function getUserSecret(phoneNumber: string, salt: string): string {
  if (!phoneNumber || !salt) {
    throw new Error(
      "Phone number and salt are required to generate a user secret.",
    );
  }
  return createHash("sha256")
    .update(phoneNumber + salt)
    .digest("hex");
}

export function normalizePhone(phone: string) {
  const result = phone.replace(/[^\d]/g, "").trim().startsWith("1")
    ? phone.substring(1)
    : phone;

  if (result.length !== 10) {
    throw new Error("Invalid phone number.");
  }

  return result;
}

export function isValidPhone(phone: string): boolean {
  phone = normalizePhone(phone);
  const match = phone.match(/(\d{3})(\d{3})(\d{4})/);
  const [, prefix, exchange, station] = match ?? [];
  const isValidNANPFormat =
    /^[2-7][0-8][0-9]$/.test(prefix) && /^[2-9][0-9]{2}$/.test(exchange);
  const isNotAllSameDigit = !/^(.)\1{6}$/.test(exchange + station);
  const isNot911Number = prefix !== "911" && exchange !== "911";
  const isNot555Number = prefix !== "555" && exchange !== "555";
  const isNotPopSongNumber = exchange !== "867" && station !== "5309";

  return (
    isValidNANPFormat &&
    isNotAllSameDigit &&
    isNot911Number &&
    isNot555Number &&
    isNotPopSongNumber
  );
}

export function generateOtp(phoneNumber: string, salt: string): string {
  const userSecret = getUserSecret(phoneNumber, salt);
  return authenticator.generate(userSecret);
}

export function verifyOtp(
  phoneNumber: string,
  salt: string,
  token: string,
): boolean {
  const userSecret = getUserSecret(phoneNumber, salt);
  return authenticator.verify({ token, secret: userSecret });
}

export function getOtpStep(): number {
  const step = authenticator.options.step;
  if (typeof step !== "number") {
    return 0;
  }
  return step;
}

export function isRateLimitedForMsgs(phoneNumber: string): boolean {
  const submissionTimestampsArray = submissionTimestamps.get(phoneNumber);
  if (!submissionTimestampsArray || submissionTimestampsArray.length === 0) {
    return false;
  }

  const now = Date.now();
  const recentSubmissions = submissionTimestampsArray.filter(
    (timestamp: number) => now - timestamp < ONE_WEEK_IN_MS,
  );

  if (recentSubmissions.length !== submissionTimestampsArray.length) {
    submissionTimestamps.set(phoneNumber, recentSubmissions);
  }

  return recentSubmissions.length >= MAX_MESSAGES_PER_WEEK;
}

export function recordMsgSubmission(phoneNumber: string) {
  const now = Date.now();
  const existingSubmissions = submissionTimestamps.get(phoneNumber) || [];

  const recentSubmissions = existingSubmissions.filter(
    (timestamp: number) => now - timestamp < ONE_WEEK_IN_MS,
  );
  recentSubmissions.push(now);

  submissionTimestamps.set(phoneNumber, recentSubmissions);
}

export function isRateLimitedForOtp(phoneNumber: string): boolean {
  const requestTimestamps = otpRequestTimestamps.get(phoneNumber);
  if (!requestTimestamps || requestTimestamps.length === 0) {
    return false;
  }

  const now = Date.now();
  const recentRequests = requestTimestamps.filter(
    (timestamp: number) => now - timestamp < ONE_HOUR_IN_MS,
  );

  if (recentRequests.length !== requestTimestamps.length) {
    otpRequestTimestamps.set(phoneNumber, recentRequests);
  }

  return recentRequests.length >= MAX_OTP_REQUESTS_PER_HOUR;
}

export function recordOtpRequest(phoneNumber: string) {
  const now = Date.now();
  const existingRequests = otpRequestTimestamps.get(phoneNumber) || [];

  const recentRequests = existingRequests.filter(
    (timestamp: number) => now - timestamp < ONE_HOUR_IN_MS,
  );
  recentRequests.push(now);

  otpRequestTimestamps.set(phoneNumber, recentRequests);
}

export default {
  normalizePhone,
  isValidPhone,
  generateOtp,
  verifyOtp,
  getOtpStep,
  recordOtpRequest,
  recordMsgSubmission,
  isRateLimitedForOtp,
  isRateLimitedForMsgs,
};
