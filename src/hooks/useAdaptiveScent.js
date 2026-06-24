import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LOCATION,
  fetchForecastForCurrentLocation,
  fetchForecastForDefaultLocation,
} from '../services/weatherService.js'
import { buildAdaptiveScentData } from '../utils/scentMatcher.js'

function useAdaptiveScent(products = []) {
  const [enabled, setEnabled] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [status, setStatus] = useState({
    loading: false,
    error: '',
    usingDefault: false,
  })

  useEffect(() => {
    if (!enabled || forecast || status.loading || status.error) return undefined

    let active = true
    const load = async () => {
      try {
        setStatus({ loading: true, error: '', usingDefault: false })
        const data = await fetchForecastForCurrentLocation()
        if (!active) return
        setForecast(data)
        setStatus({ loading: false, error: '', usingDefault: false })
      } catch (error) {
        if (!active) return
        try {
          const fallback = await fetchForecastForDefaultLocation()
          if (!active) return
          setForecast(fallback)
          setStatus({ loading: false, error: '', usingDefault: true })
        } catch (fallbackError) {
          if (!active) return
          setStatus({
            loading: false,
            error:
              fallbackError?.message ||
              error?.message ||
              'Unable to load weather forecast right now.',
            usingDefault: true,
          })
        }
      }
    }

    load()
    return () => {
      active = false
    }
  }, [enabled, forecast, status.error, status.loading])

  const setAdaptiveEnabled = (nextEnabled) => {
    setEnabled(nextEnabled)
    if (!nextEnabled) {
      setForecast(null)
      setStatus({ loading: false, error: '', usingDefault: false })
    }
  }

  const adaptiveData = useMemo(
    () => buildAdaptiveScentData(products, forecast),
    [products, forecast]
  )

  return {
    adaptiveData,
    enabled,
    locationLabel: DEFAULT_LOCATION.label,
    setAdaptiveEnabled,
    status,
  }
}

export default useAdaptiveScent
