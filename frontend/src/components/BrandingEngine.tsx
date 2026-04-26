import { useEffect } from 'react'

interface BrandingConfig {
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
  partner_name?: string;
}

export function BrandingEngine({ config }: { config?: BrandingConfig }) {
  useEffect(() => {
    if (!config) return

    const root = document.documentElement
    
    if (config.primary_color) {
      root.style.setProperty('--color-rihla', config.primary_color)
      // Generate a darker version for gradients (simplified for demo)
      root.style.setProperty('--color-rihla-dark', config.primary_color) 
    }

    // Cleanup or reset to default
    return () => {
      root.style.removeProperty('--color-rihla')
      root.style.removeProperty('--color-rihla-dark')
    }
  }, [config])

  return null
}
