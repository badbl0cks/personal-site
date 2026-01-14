import Client from "android-sms-gateway";
import {
  ANDROID_SMS_GATEWAY_LOGIN,
  ANDROID_SMS_GATEWAY_PASSWORD,
  ANDROID_SMS_GATEWAY_URL,
} from "astro:env/server";
import httpFetchClient from "@lib/HttpFetchClient";

class SmsClient {
  readonly api: Client;

  constructor() {
    this.api = new Client(
      ANDROID_SMS_GATEWAY_LOGIN,
      ANDROID_SMS_GATEWAY_PASSWORD,
      httpFetchClient,
      ANDROID_SMS_GATEWAY_URL,
    );
  }

  async sendSMS(phoneNumber: string, message: string) {
    const bundle = {
      phoneNumbers: [phoneNumber],
      message: message,
    };
    try {
      const msg_state = await this.api.send(bundle);
      return {
        success: true,
        id: msg_state.id,
        state: msg_state.state,
      };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, message: error.message };
      }
      return { success: false, message: "Unknown sendSMS error." };
    }
  }

  async update(id: string) {
    try {
      const msg_state = await this.api.getState(id);
      return {
        success: true,
        id: msg_state.id,
        state: msg_state.state,
      };
    } catch (error) {
      return { success: false, id: id, message: error };
    }
  }
}

export default SmsClient;
