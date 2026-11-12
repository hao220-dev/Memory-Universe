/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        void: '#050816',
        deep: '#0B1530',
        neon: '#38BDF8',
        nebula: '#A855F7',
        star: '#F8FAFC',
        muted: '#94A3B8'
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 40px rgba(56, 189, 248, 0.35)',
        'glow-violet': '0 0 50px rgba(168, 85, 247, 0.35)'
      },
      transitionTimingFunction: {
        cinematic: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    }
  },
  plugins: []
}
