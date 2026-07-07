/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C1B19",
        "ink-soft": "#4a4741",
        paper: "#EDEAE2",
        "paper-dim": "#E2DDD0",
        card: "#F8F6EF",
        rule: "#C9C4B8",
        "rule-strong": "#a9a396",
        red: "#A6291F",
        "red-dim": "#8a231b",
        green: "#3F6B4A",
        amber: "#B8863A",
      },
      fontFamily: {
        serif: ["Fraunces", "serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
