import axios from 'axios'

let _tokenGetter: (() => Promise<string>) | null = null

export function setTokenGetter(fn: (() => Promise<string>) | null): void {
  _tokenGetter = fn
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  if (_tokenGetter) {
    try {
      const token = await _tokenGetter()
      config.headers.Authorization = `Bearer ${token}`
    } catch (err) {
      console.error('[apiClient] Token getter failed — sending request without auth', err)
    }
  }
  return config
})
