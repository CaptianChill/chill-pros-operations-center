import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefaff",
          100: "#d9f2ff",
          200: "#b3e5ff",
          300: "#7edbff",
          400: "#3cc2ff",
          500: "#0aa2f2",
          600: "#008cff",
          700: "#0068c2",
          800: "#04528f",
          900: "#0a3b64",
          950: "#06213a"
        },
        ink: {
          50: "#f4f7f9",
          100: "#e6ecf0",
          200: "#c8d5dd",
          300: "#9fb2bd",
          400: "#718794",
          500: "#546878",
          600: "#425261",
          700: "#36434f",
          800: "#252e37",
          900: "#161c22",
          950: "#0a0d10"
        }
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgb(10 13 16 / 0.06), 0 1px 3px 0 rgb(10 13 16 / 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
