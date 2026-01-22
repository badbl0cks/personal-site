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

export function validatePhoneNumber(unsafePhoneNum: string) {
  if (typeof unsafePhoneNum !== "string") {
    return { success: false, message: "Invalid phone number." };
  }

  unsafePhoneNum = unsafePhoneNum.replace(/[^0-9]/g, "").trim();
  const cleanedNumber = unsafePhoneNum.startsWith("1")
    ? unsafePhoneNum.substring(1)
    : unsafePhoneNum;

  const isValidFormat = /^[2-7][0-8][0-9][2-9][0-9]{6}$/.test(cleanedNumber);
  const isNotAllSameDigit = !/^(.)\1{9}$/.test(cleanedNumber);
  const isNot911Number = !/^[0-9]{3}911[0-9]{4}$/.test(cleanedNumber);
  const isNot555Number = !/^[0-9]{3}555[0-9]{4}$/.test(cleanedNumber);
  const isNotPopSongNumber = !/^[0-9]{3}8675309$/.test(cleanedNumber);

  if (
    isValidFormat &&
    isNotAllSameDigit &&
    isNot911Number &&
    isNot555Number &&
    isNotPopSongNumber
  ) {
    return { success: true, validatedPhoneNumber: cleanedNumber };
  }

  return { success: false, validatedPhoneNumber: undefined };
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
  validatePhoneNumber,
  generateOtp,
  verifyOtp,
  getOtpStep,
  recordOtpRequest,
  recordMsgSubmission,
  isRateLimitedForOtp,
  isRateLimitedForMsgs,
};
