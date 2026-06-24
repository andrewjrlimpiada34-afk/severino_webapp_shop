import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_LOCATION,
  fetchForecastForCurrentLocation,
  fetchForecastForDefaultLocation,
} from '../services/weatherService.js'
import { buildAdaptiveScentData } from '../utils/scentMatcher.js'

function useAdaptiveScent(products = []) {
  const [enabled, setEnabled] = useState(false)
  const [forecast, setForecast] = useState(null)
  const requestIdRef = useRef(0)
  const [status, setStatus] = useState({
    loading: false,
    error: '',
    usingDefault: false,
  })

  useEffect(() => {
    if (!enabled || forecast || status.loading || status.error) return undefined

    let active = true
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const load = async () => {
      try {
        setStatus({ loading: true, error: '', usingDefault: false })
        const data = await fetchForecastForCurrentLocation()
        if (!active || requestIdRef.current !== requestId) return
        setForecast(data)
        setStatus({ loading: false, error: '', usingDefault: false })
      } catch (error) {
        if (!active || requestIdRef.current !== requestId) return
        try {
          const fallback = await fetchForecastForDefaultLocation()
          if (!active || requestIdRef.current !== requestId) return
          setForecast(fallback)
          setStatus({ loading: false, error: '', usingDefault: true })
        } catch (fallbackError) {
          if (!active || requestIdRef.current !== requestId) return
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
      requestIdRef.current += 1
      setForecast(null)
      setStatus({ loading: false, error: '', usingDefault: false })
    }
  }

  const useDefaultLocation = async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setEnabled(true)
    setStatus({ loading: true, error: '', usingDefault: true })

    try {
      const fallback = await fetchForecastForDefaultLocation()
      if (requestIdRef.current !== requestId) return
      setForecast(fallback)
      setStatus({ loading: false, error: '', usingDefault: true })
    } catch (error) {
      if (requestIdRef.current !== requestId) return
      setStatus({
        loading: false,
        error: error?.message || 'Unable to load Marinduque weather forecast right now.',
        usingDefault: true,
      })
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
    useDefaultLocation,
  }
}

export default useAdaptiveScent
