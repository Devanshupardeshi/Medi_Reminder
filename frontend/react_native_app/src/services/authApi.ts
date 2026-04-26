import { apiRequest } from './apiClient';
import type {
  AuthUser,
  OtpRequestResponse,
  OtpVerifyResponse,
} from '@/types/auth';

export const authApi = {
  requestOtp(email: string): Promise<OtpRequestResponse> {
    return apiRequest({
      method: 'POST',
      path: '/auth/otp/request',
      body: { email: email.trim().toLowerCase() },
    });
  },

  resendOtp(email: string): Promise<OtpRequestResponse> {
    return apiRequest({
      method: 'POST',
      path: '/auth/otp/resend',
      body: { email: email.trim().toLowerCase() },
    });
  },

  verifyOtp(email: string, otp: string): Promise<OtpVerifyResponse> {
    return apiRequest({
      method: 'POST',
      path: '/auth/otp/verify',
      body: { email: email.trim().toLowerCase(), otp: otp.trim() },
    });
  },

  getProfile(): Promise<AuthUser> {
    return apiRequest({
      method: 'GET',
      path: '/users/profile',
      auth: true,
    });
  },

  updateProfile(input: {
    first_name?: string;
    last_name?: string;
  }): Promise<AuthUser & { success: boolean; message: string }> {
    return apiRequest({
      method: 'PATCH',
      path: '/users/profile',
      body: input,
      auth: true,
    });
  },

  ping(): Promise<{ status: string }> {
    return apiRequest({ method: 'GET', path: '/health' });
  },
};
