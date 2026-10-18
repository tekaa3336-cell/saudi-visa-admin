export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'] },
      colors: {
        pine: { 950: '#071F18', 900: '#0B2F26', 800: '#12443A', 700: '#1B5C4E' },
        sand: { 400: '#D9B65B', 500: '#C8A24A' },
        paper: '#F2F4F3',
        night: '#0E1513',
      },
    },
  },
  plugins: [],
}
