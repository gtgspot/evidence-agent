import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        "brand-blue": "hsl(var(--brand-blue))",
        "brand-red": "hsl(var(--brand-red))",
        "brand-yellow": "hsl(var(--brand-yellow))",
        "brand-green": "hsl(var(--brand-green))",
        "brand-grey": "hsl(var(--brand-grey))",
        "brand-grey-500": "hsl(var(--brand-grey-500))",
      },
      boxShadow: {
        glow: "0 0 0 1px hsl(var(--border)), 0 18px 40px -28px rgba(60, 64, 67, 0.42)",
      },
      backgroundImage: {
        noise:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,.08) 1px, transparent 0)",
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "ui-sans-serif", "system-ui"],
        body: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular"],
      },
    },
  },
  plugins: [],
};

export default config;
