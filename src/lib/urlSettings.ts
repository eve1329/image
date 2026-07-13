import type { AppSettings } from '../types'
import { normalizeSettings } from './apiProfiles'

const URL_SETTING_KEYS = ['settings', 'apiUrl', 'apiKey', 'codexCli', 'apiMode', 'model', 'profileName', 'streamImages', 'streamPartialImages']

function getUrlSettingsPayload(searchParams: URLSearchParams): unknown | null {
  const raw = searchParams.get('settings')
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && 'settings' in parsed
      ? (parsed as { settings?: unknown }).settings ?? null
      : parsed
  } catch {
    return null
  }
}

function getImportedApiKey(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ''
  const record = payload as Record<string, unknown>
  if (typeof record.apiKey === 'string') return record.apiKey.trim()
  if (Array.isArray(record.profiles)) {
    const profile = record.profiles.find((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item) && typeof (item as Record<string, unknown>).apiKey === 'string')
    return typeof profile?.apiKey === 'string' ? profile.apiKey.trim() : ''
  }
  return ''
}

export function hasUrlSettingParams(searchParams: URLSearchParams) {
  return URL_SETTING_KEYS.some((key) => searchParams.has(key))
}

export function clearUrlSettingParams(searchParams: URLSearchParams) {
  for (const key of URL_SETTING_KEYS) searchParams.delete(key)
}

export function buildSettingsFromUrlParams(currentSettings: Partial<AppSettings> | unknown, searchParams: URLSearchParams): Partial<AppSettings> {
  const apiKey = searchParams.get('apiKey')?.trim() || getImportedApiKey(getUrlSettingsPayload(searchParams))
  return apiKey ? normalizeSettings({ ...normalizeSettings(currentSettings), apiKey }) : {}
}
