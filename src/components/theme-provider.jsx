import { createContext, useContext, useEffect, useState } from "react"

const ThemeProviderContext = createContext(null)

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "vite-ui-theme",
  ...props
}) {
  const [theme, setTheme] = useState(
    () => {
      // Check URL params first (for auxiliary windows)
      const params = new URLSearchParams(window.location.search)
      const urlTheme = params.get('theme')
      if (urlTheme) return urlTheme

      return localStorage.getItem(storageKey) || defaultTheme
    }
  )

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark", "violet", "green", "cloud-dancer")
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
      return
    }
    root.classList.add(theme)
    if (theme === "violet" || theme === "green") {
      root.classList.add("dark")
    }
  }, [theme])

  // Listen for IPC updates
  useEffect(() => {
    if (window.api && window.api.onThemeChanged) {
      const cleanup = window.api.onThemeChanged((newTheme) => {
        setTheme(newTheme)
        localStorage.setItem(storageKey, newTheme)
      })
      return cleanup
    }
  }, [storageKey])

  const value = {
    theme,
    setTheme: (newTheme) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
      // Sync via IPC
      if (window.api && window.api.setTheme) {
        window.api.setTheme(newTheme)
      }
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")
  return context
} 