/**
 * # Passkey Composable
 *
 * Wraps @simplewebauthn/browser to handle passkey registration and authentication.
 *
 * ## Registration flow (adding a passkey — user is already logged in):
 * 1. Call `registerPasskey()` → fetches options from API → browser prompts for biometric
 * 2. Browser creates a credential → sent to API for verification → passkey stored
 *
 * ## Authentication flow (logging in with a passkey — user is NOT logged in):
 * 1. Call `loginWithPasskey()` → fetches options from API → browser prompts for biometric
 * 2. Browser signs the challenge → sent to API → verified → tokens returned
 *
 * ## Management:
 * - `listPasskeys()` — fetch all passkeys for the current user
 * - `renamePasskey()` — change a passkey's friendly name
 * - `deletePasskey()` — remove a passkey
 */
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser'
import type { AuthUser } from '@paisa/shared'

export interface PasskeyInfo {
  id: string
  deviceName: string | null
  createdAt: string
}

export function usePasskey() {
  const { apiFetch, setTokens, fetchUser } = useAuth()
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBaseUrl as string

  /**
   * Register a new passkey for the current user.
   *
   * Requires the user to be authenticated (JWT token in memory).
   * Prompts the user's browser/OS for biometric verification.
   *
   * @param deviceName - Optional friendly name like "MacBook Touch ID"
   * @returns The newly created passkey info
   */
  async function registerPasskey(deviceName?: string): Promise<PasskeyInfo> {
    // Step 1: Get registration options from the API
    const options = await apiFetch<any>('/auth/passkey/register/options', {
      method: 'POST',
    })

    // Step 2: Prompt the browser to create a credential
    // This triggers Touch ID / Face ID / Windows Hello / USB key
    const credential = await startRegistration({ optionsJSON: options })

    // Step 3: Send the credential to the API for verification
    const result = await apiFetch<PasskeyInfo>('/auth/passkey/register/verify', {
      method: 'POST',
      body: { response: credential, deviceName },
    })

    // Refresh user data so `hasPasskey` updates
    await fetchUser()

    return result
  }

  /**
   * Login with a passkey (no email/password needed).
   *
   * This is called from the login page. The user is NOT authenticated.
   * The browser prompts for biometric → API verifies → tokens returned.
   */
  async function loginWithPasskey(): Promise<void> {
    // Step 1: Get authentication options from the API (public endpoint)
    const options = await $fetch<{ data: any }>('/auth/passkey/login/options', {
      baseURL: apiBase,
      method: 'POST',
    })
    const optionsData = (options as any)?.data ?? options

    // Step 2: Prompt the browser to sign the challenge
    const credential = await startAuthentication({ optionsJSON: optionsData })

    // Step 3: Send the signed response to the API
    const result = await $fetch<{ data: { accessToken: string; expiresIn: number; user: AuthUser } }>('/auth/passkey/login/verify', {
      baseURL: apiBase,
      method: 'POST',
      body: { response: credential, sessionId: optionsData.sessionId },
      credentials: 'include', // For the refresh cookie
    })

    const data = (result as any)?.data ?? result

    // Store tokens and navigate
    setTokens(data.accessToken, data.expiresIn)
    const { user } = useAuth()
    user.value = data.user
    await navigateTo('/dashboard')
  }

  /** List all passkeys for the current user */
  async function listPasskeys(): Promise<PasskeyInfo[]> {
    return apiFetch<PasskeyInfo[]>('/auth/passkey')
  }

  /** Rename a passkey */
  async function renamePasskey(passkeyId: string, deviceName: string): Promise<void> {
    await apiFetch(`/auth/passkey/${passkeyId}`, {
      method: 'PATCH',
      body: { deviceName },
    })
  }

  /** Delete a passkey */
  async function deletePasskey(passkeyId: string): Promise<void> {
    await apiFetch(`/auth/passkey/${passkeyId}`, {
      method: 'DELETE',
    })
    // Refresh user data so `hasPasskey` updates
    await fetchUser()
  }

  return {
    registerPasskey,
    loginWithPasskey,
    listPasskeys,
    renamePasskey,
    deletePasskey,
  }
}
