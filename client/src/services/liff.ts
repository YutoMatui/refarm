/**
 * LINE LIFF Service
 * Handles LIFF SDK initialization and authentication
 */
import liff from '@liff/sdk'

export interface LIFFProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

class LIFFService {
  private initialized = false
  private idToken: string | null = null

  /**
   * Initialize LIFF SDK
   */
  async init(): Promise<void> {
    if (this.initialized) return

    const liffId = import.meta.env.VITE_LIFF_ID

    if (!liffId || liffId === 'mock-liff-id-for-development') {
      console.warn('LIFF ID not configured. Using mock mode.')
      this.initialized = true
      return
    }

    try {
      await liff.init({ liffId })
      this.initialized = true
      console.log('LIFF initialized successfully')
    } catch (error) {
      console.error('LIFF initialization failed:', error)
      throw error
    }
  }

  /**
   * Check if running in LIFF browser
   */
  isInClient(): boolean {
    if (!this.initialized) return false
    return liff.isInClient()
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    if (!this.initialized) return false
    return liff.isLoggedIn()
  }

  /**
   * Login with LINE
   */
  login(): void {
    if (!this.initialized) {
      console.warn('LIFF not initialized')
      return
    }
    liff.login()
  }

  /**
   * Logout from LINE
   */
  logout(): void {
    if (!this.initialized) return
    liff.logout()
    this.idToken = null
  }

  /**
   * Get user profile from LINE
   */
  async getProfile(): Promise<LIFFProfile | null> {
    if (!this.initialized || !this.isLoggedIn()) {
      return null
    }

    try {
      const profile = await liff.getProfile()
      return {
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage,
      }
    } catch (error) {
      console.error('Failed to get profile:', error)
      return null
    }
  }

  /**
   * Get ID Token for backend authentication
   * This is the CRITICAL security token
   */
  getIDToken(): string | null {
    if (!this.initialized || !this.isLoggedIn()) {
      return null
    }

    try {
      // Get ID Token from LIFF SDK
      const token = liff.getIDToken()
      this.idToken = token
      return token
    } catch (error) {
      console.error('Failed to get ID token:', error)
      return null
    }
  }

  /**
   * Get stored ID Token
   */
  getStoredIDToken(): string | null {
    return this.idToken
  }

  /**
   * Close LIFF window
   */
  closeWindow(): void {
    if (!this.initialized) return
    liff.closeWindow()
  }

  /**
   * Open external URL in LINE's in-app browser
   */
  openWindow(url: string, external = true): void {
    if (!this.initialized) {
      window.open(url, external ? '_blank' : '_self')
      return
    }
    liff.openWindow({
      url,
      external,
    })
  }

  /**
   * Send message to LINE chat (if available)
   */
  async sendMessages(messages: any[]): Promise<void> {
    if (!this.initialized) return

    try {
      await liff.sendMessages(messages)
    } catch (error) {
      console.error('Failed to send messages:', error)
    }
  }
}

// Export singleton instance
export const liffService = new LIFFService()
