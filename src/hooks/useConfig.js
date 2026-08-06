import { useCallback, useEffect, useState } from 'react'
import { loadConfig, saveConfig } from '../firebase/planillas'
import { DEFAULT_CONFIG } from '../data/defaults'

export function useConfig(clubId) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clubId) return
    let active = true
    setLoading(true)
    loadConfig(clubId)
      .then((c) => active && setConfig(c))
      .catch(() => active && setConfig(DEFAULT_CONFIG))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [clubId])

  const save = useCallback(
    async (next) => {
      setConfig(next) // optimista
      await saveConfig(clubId, next)
    },
    [clubId],
  )

  return { config, loading, saveConfig: save }
}
