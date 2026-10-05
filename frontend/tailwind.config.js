/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Instrument Sans"', "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        paper: "#F3F5F7",
        ink: "#16202B",
        mute: "#5B6877",
        line: "#D5DBE2",
        sea: { DEFAULT: "#0E6B66", dark: "#0A524E", tint: "#E1F0EE" },
      },
    },
  },
  plugins: [],
};
