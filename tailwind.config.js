/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "src/**/*.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        quote: ['"Playfair Display"', 'serif'],
      },
      colors: {
        quote: {
          primary: '#524439',
          secondary: '#C6BFB7',
          background: '#F2ECE1',
        }
      }
    },
  },
  plugins: [],
}

