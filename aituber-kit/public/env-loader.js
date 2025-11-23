// public/env-loader.js
(async () => {
  const params = new URLSearchParams(location.search)
  const app = params.get("app") || "A"  // ?app=A または B

  const file = `env/env.${app}`

  const results = {}

  try {
    const res = await fetch(file)
    if (res.ok) {
      const text = await res.text()

      for (let line of text.split("\n")) {
        line = line.trim()
        if (!line || line.startsWith("#")) continue
        const [key, ...rest] = line.split("=")
        if (!key.startsWith("NEXT_PUBLIC_")) continue
        let value = rest.join("=").trim()
        value = value.replace(/^"|"$/g, "")
        results[key] = value
      }
    }
  } catch {}

  console.log("[env-loader] loaded:", file, results)
  window.__env = results
})()
