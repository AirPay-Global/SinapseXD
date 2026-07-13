import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        ring: "var(--ring)",
        success: "var(--success)",
        warning: "var(--warning)",
        destructive: "var(--destructive)",
        info: "var(--info)",
        simulation: "var(--simulation)",
        "surface-sidebar": "var(--surface-sidebar)",
        "surface-muted": "var(--surface-muted)",
        "surface-active": "var(--surface-active)",
        brand: {
          navy: "var(--brand-navy)",
          blue: "var(--brand-blue)",
          orange: "var(--brand-orange)",
          "light-blue": "var(--brand-light-blue)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      boxShadow: {
        // Namespaced so existing `shadow-sm/md/lg` utilities keep Tailwind's
        // scale; new components opt in with `shadow-elev-*`.
        "elev-sm": "var(--shadow-sm)",
        "elev-md": "var(--shadow-md)",
        "elev-lg": "var(--shadow-lg)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        heading: "var(--font-heading)",
      },
    },
  },
  plugins: [],
};

export default config;
