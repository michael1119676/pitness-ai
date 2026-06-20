import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101820",
        panel: "#f7f8fa",
        line: "#d9dee5",
        mint: "#0f9f7a",
        coral: "#d85c4a",
        gold: "#c98a16"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(16, 24, 32, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
