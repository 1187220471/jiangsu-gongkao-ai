import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || ''

export function signToken(payload: { userId: string; username: string }) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET 环境变量未设置，请检查环境配置')
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET 环境变量未设置')
    return null
  }
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string }
  } catch {
    return null
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

/**
 * 统一的认证中间件
 * 返回 payload 或自动返回 401 响应
 */
export function requireAuth(request: Request):
  | { userId: string; username: string; success: true }
  | { success: false; response: NextResponse } {
  const token = getTokenFromRequest(request)
  if (!token) {
    return {
      success: false,
      response: NextResponse.json({ error: '未登录' }, { status: 401 }),
    }
  }

  const payload = verifyToken(token)
  if (!payload) {
    return {
      success: false,
      response: NextResponse.json({ error: '登录已过期' }, { status: 401 }),
    }
  }

  return { ...payload, success: true }
}

/**
 * 前端统一的请求头封装
 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}
