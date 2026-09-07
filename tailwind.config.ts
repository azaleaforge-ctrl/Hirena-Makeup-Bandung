import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        hirena: {
          cream: "#FFFCFA",
          cream2: "#F6F1EB",
          ink: "#1A1A1A",
          gold: "#C9A96E",
          line: "#EDE3DA",
        },
        // flat aliases for convenience
        cream: "#FFFCFA",
        cream2: "#F6F1EB",
        ink: "#1A1A1A",
        gold: "#C9A96E",
        line: "#EDE3DA",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "serif"],
        serif2: ["var(--font-cormorant)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
