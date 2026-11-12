import http from './http'
import type { ApiResponse, LoginResponse, UserSummary } from '@/types/domain'

export interface LoginPayload {
  username: string
  password: string
}

export interface SetupStatus {
  initialized: boolean
  setupAllowed: boolean
}

export async function fetchSetupStatus(): Promise<SetupStatus> {
  const { data } = await http.get<ApiResponse<SetupStatus>>('/api/auth/setup-status')
  return data.data
}

export async function setupAdmin(password: string): Promise<LoginResponse> {
  const { data } = await http.post<ApiResponse<LoginResponse>>('/api/auth/setup', { password })
  return data.data
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await http.post<ApiResponse<LoginResponse>>('/api/auth/login', payload)
  return data.data
}

export async function fetchMe(): Promise<UserSummary> {
  const { data } = await http.get<ApiResponse<UserSummary>>('/api/auth/me')
  return data.data
}
