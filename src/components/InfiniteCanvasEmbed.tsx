import { useMemo } from 'react'
import { useStore } from '../store'
import { buildInfiniteCanvasUrl, getInfiniteCanvasBaseUrl } from '../lib/infiniteCanvasUrl'

export default function InfiniteCanvasEmbed() {
  const settings = useStore((s) => s.settings)
  const canvasUrl = useMemo(() => buildInfiniteCanvasUrl(settings, getInfiniteCanvasBaseUrl()), [settings])

  return (
    <main className="h-[calc(100vh-4.5rem)] min-h-[34rem] overflow-hidden bg-black">
      <iframe
        title="无限画布"
        src={canvasUrl}
        className="h-full w-full border-0 bg-white"
        allow="clipboard-read; clipboard-write; fullscreen; private-state-token-redemption; private-state-token-issuance"
        referrerPolicy="unsafe-url"
      />
    </main>
  )
}
