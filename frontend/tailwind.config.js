/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f8ff",
          100: "#e8efff",
          200: "#c8d8ff",
          300: "#9ebcff",
          400: "#6f98ff",
          500: "#4674f5",
          600: "#2f58d9",
          700: "#2545ad",
          800: "#213d89",
          900: "#22376c"
        }
      }
    }
  },
  plugins: []
};
