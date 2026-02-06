/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: '#1a1a2e',
          surface: '#16213e',
          panel: '#0f3460',
          border: '#3a3a5c',
          'border-light': '#5a5a8c',
          'border-dark': '#0a0a1a',
          text: '#c0c0c0',
          'text-bright': '#e0e0e0',
          green: '#39ff14',
          amber: '#ffb000',
          cyan: '#00d4ff',
          red: '#ff3333',
          blue: '#4488ff',
          'user-bg': '#2a2a5e',
          'assistant-bg': '#1e1e3a',
        },
      },
      fontFamily: {
        retro: ['VT323', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}
