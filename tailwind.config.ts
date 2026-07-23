import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 主色改为 blue-500（#3b82f6），与小程序对齐
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // 覆盖 Tailwind 内置 slate 色值为小程序灰系（标准 gray 色系）
        slate: {
          50: '#f5f5f5',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#111827',
          900: '#0f172a',
        },
      },
      // 自定义圆角值（小程序特有值）
      borderRadius: {
        card: '16px',
        'card-lg': '20px',
        'card-xl': '24px',
        btn: '14px',
        'btn-sm': '10px',
      },
      // 自定义阴影（小程序风格）
      boxShadow: {
        card: '0 2px 12px rgba(0, 0, 0, 0.04)',
        'card-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'card-lg': '0 2px 12px rgba(0, 0, 0, 0.06)',
        btn: '0 4px 0 #374151',
        'btn-sm': '0 3px 0 #374151',
        ring: '0 4px 20px rgba(0, 0, 0, 0.06)',
        'inset-sm': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
      },
      // 自定义字号
      fontSize: {
        xxs: ['11px', { lineHeight: '1.2' }],
      },
      // 自定义 spacing
      spacing: {
        '4.5': '18px',
        '3.5': '14px',
      },
    },
  },
  plugins: [],
}

export default config
