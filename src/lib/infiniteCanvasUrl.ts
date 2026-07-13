import type { AppSettings } from '../types'
import { readRuntimeEnv } from './runtimeEnv'

export const DEFAULT_INFINITE_CANVAS_URL = 'http://localhost:3002/canvas'

export function getInfiniteCanvasBaseUrl() {
  return readRuntimeEnv(import.meta.env.VITE_INFINITE_CANVAS_URL) || DEFAULT_INFINITE_CANVAS_URL
}

export function buildInfiniteCanvasUrl(settings: AppSettings, baseUrl = getInfiniteCanvasBaseUrl()) {
  void settings
  const url = new URL(baseUrl)
  return url.toString()
}
