/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 深色背景系
        surface: {
          bg: '#0b1220',
          primary: '#0f172a',
          secondary: '#131c31',
          tertiary: '#1e293b'
        },
        // 玻璃拟态
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.06)',
          border: 'rgba(255, 255, 255, 0.10)',
          highlight: 'rgba(255, 255, 255, 0.12)',
          text: 'rgba(255, 255, 255, 0.70)'
        },
        // 极光强调色
        aurora: {
          green: '#34d399',
          cyan: '#22d3ee',
          violet: '#a78bfa',
          pink: '#f472b6'
        },
        // 状态色（适配深色主题）
        status: {
          healthy: '#34d399',
          warning: '#fbbf24',
          danger: '#fb7185'
        },
        // 模块 hero 强调色
        module: {
          nutrition: {
            from: '#f59e0b',
            to: '#f43f5e'
          },
          sleep: {
            from: '#818cf8',
            to: '#c084fc'
          },
          mind: {
            from: '#a3e635',
            to: '#818cf8'
          },
          advisor: {
            from: '#0ea5e9',
            to: '#2563eb'
          },
          profile: {
            from: '#64748b',
            to: '#94a3b8'
          }
        },
        // 文字色
        content: {
          primary: '#f8fafc',
          secondary: '#94a3b8',
          tertiary: '#64748b'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif'
        ]
      },
      spacing: {
        // Safe Area 安全区（PRD 4.2：处理刘海屏/灵动岛）
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)'
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px'
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(2, 8, 20, 0.36)',
        'glass-lg': '0 12px 48px rgba(2, 8, 20, 0.48)',
        'glow-green': '0 0 20px rgba(52, 211, 153, 0.25)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.25)',
        'glow-violet': '0 0 20px rgba(167, 139, 250, 0.25)'
      },
      animation: {
        // 呼吸灯、思考中
        'breathe': 'breathe 4s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite'
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.08)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(52, 211, 153, 0.2)' },
          '50%': { boxShadow: '0 0 24px rgba(52, 211, 153, 0.45)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      backgroundImage: {
        'aurora-gradient': 'linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #a78bfa 100%)',
        'aurora-soft': 'linear-gradient(135deg, rgba(52,211,153,0.15) 0%, rgba(34,211,238,0.15) 50%, rgba(167,139,250,0.15) 100%)'
      }
    }
  },
  plugins: []
}
