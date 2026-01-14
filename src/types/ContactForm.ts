export type FieldKey = "name" | "phone" | "msg" | "code" | "captcha" | "form";
export type FieldValue = {
  hasError: boolean;
  value?: string;
  error?: string;
};

export type Fields<K extends FieldKey> = { [P in K]-?: FieldValue };

export type BaseState<K extends FieldKey> = {
  state: string;
  fields: Fields<K>;
  error?: string;
  hasError: boolean;
};

export type InitialState = {
  state: "initial";
} & BaseState<never>;

export type SendOtpState = {
  state: "send_otp";
} & BaseState<"name" | "phone" | "msg" | "captcha">;

export type OtpSentState = {
  state: "otp_sent";
} & BaseState<"name" | "phone" | "msg" | "captcha">;

export type SendMsgState = {
  state: "send_msg";
} & BaseState<"name" | "phone" | "msg" | "code" | "captcha">;

export type CompleteState = {
  state: "complete";
} & BaseState<never>;

export type State =
  | InitialState
  | SendOtpState
  | OtpSentState
  | SendMsgState
  | CompleteState;
