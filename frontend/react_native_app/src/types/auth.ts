export interface AuthUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  last_login_at: string;
}

export interface OtpRequestResponse {
  success: boolean;
  message: string;
  resend_after_seconds: number;
}

export interface OtpVerifyResponse {
  success: boolean;
  message: string;
  is_new_user: boolean;
  user: AuthUser;
  access_token: string;
  token_type: 'bearer';
}
