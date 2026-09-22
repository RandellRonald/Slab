import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slab: {
          background: "#fbfaf6",
          surface: "#fffefa",
          primary: "#d99b00",
          primaryHover: "#e7ad0a",
          primaryStrong: "#966800",
          yellow: "#d99b00",
          ink: "#171716",
          muted: "#625f58",
          border: "#ded8cc",
          success: "#15803d",
          warning: "#b45309",
          error: "#b91c1c"
        }
      },
      boxShadow: {
        soft: "0 14px 34px rgba(31, 27, 17, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
