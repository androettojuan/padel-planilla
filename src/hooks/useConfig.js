import { useCallback, useEffect, useState } from 'react'
import { loadConfig, saveConfig } from '../firebase/planillas'
import { DEFAULT_CONFIG } from '../data/defaults'

export function useConfig(enabled = true) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return
    let active = true
    loadConfig()
      .then((c) => active && setConfig(c))
      .catch(() => active && setConfig(DEFAULT_CONFIG))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [enabled])

  const save = useCallback(async (next) => {
    setConfig(next) // optimista
    await saveConfig(next)
  }, [])

  return { config, loading, saveConfig: save }
}
