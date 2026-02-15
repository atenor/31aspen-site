import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        border: "hsl(214 20% 86%)",
        input: "hsl(214 20% 86%)",
        ring: "hsl(220 50% 30%)",
        background: "hsl(215 25% 97%)",
        foreground: "hsl(220 35% 15%)",
        primary: {
          DEFAULT: "hsl(220 70% 30%)",
          foreground: "hsl(210 40% 98%)"
        },
        destructive: {
          DEFAULT: "hsl(0 80% 45%)",
          foreground: "hsl(210 40% 98%)"
        },
        muted: {
          DEFAULT: "hsl(215 20% 92%)",
          foreground: "hsl(220 15% 35%)"
        },
        accent: {
          DEFAULT: "hsl(145 30% 88%)",
          foreground: "hsl(145 45% 22%)"
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(220 35% 15%)"
        }
      }
    }
  },
  plugins: []
};

export default config;
