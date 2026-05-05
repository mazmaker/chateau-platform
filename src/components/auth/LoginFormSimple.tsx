import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimpleAuth } from '@/contexts/AuthContextSimple'
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react'

export function LoginFormSimple() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn } = useSimpleAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error, passwordResetRequired } = await signIn(formData.email, formData.password)

    if (error) {
      // Translate common errors to Thai
      let errorMessage = error.message || 'Login failed. Please try again.'

      if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      } else if (errorMessage.includes('Email not confirmed')) {
        errorMessage = 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
      } else if (errorMessage.includes('User not found')) {
        errorMessage = 'ไม่พบผู้ใช้ในระบบ'
      }

      setError(errorMessage)
      setLoading(false)
    } else {
      // Login successful - check if password reset is required
      if (passwordResetRequired) {
        // Redirect to force password change
        navigate('/auth/change-password')
      }
      // If no password reset needed, auth state change will redirect automatically
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-luxury-white rounded-2xl shadow-soft-lg border border-border p-8 gradient-card">
        {/* Logo and Title */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="flex items-center justify-center w-40 h-40 bg-luxury-white rounded-2xl mb-4 overflow-hidden shadow-soft">
            <img
              src="https://pqnjvcbmnatrtvpqnrdx.supabase.co/storage/v1/object/public/company-logos/00000000-0000-0000-0000-000000000001/1766926562152.png"
              alt="CHATEAU Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-3xl font-bold text-charcoal">
            CHATEAU PLATFORM
          </h1>
          <p className="text-luxury-gray mt-3 font-medium">เข้าสู่ระบบเพื่อจัดการธุรกิจของคุณ</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg animate-pulse shadow-soft">
            <p className="text-sm text-red-700 font-medium ">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-charcoal mb-2 ">
              อีเมล
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-luxury-gray group-focus-within:text-royal-gold transition-colors" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-royal-gold focus:border-royal-gold transition-all duration-200 hover:border-luxury-gray  bg-luxury-white"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-charcoal mb-2 ">
              รหัสผ่าน
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-luxury-gray group-focus-within:text-royal-gold transition-colors" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-12 py-3 border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-royal-gold focus:border-royal-gold transition-all duration-200 hover:border-luxury-gray  bg-luxury-white"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-luxury-gray hover:text-luxury-gray-dark transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer group">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={handleChange}
                className="h-4 w-4 text-gray-700 focus:ring-gray-500 border-gray-300 rounded transition-all duration-200"
              />
              <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                จดจำฉัน
              </span>
            </label>
            <a
              href="#"
              className="text-sm text-gray-800 hover:text-black font-medium transition-colors"
            >
              ลืมรหัสผ่าน?
            </a>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3.5 px-4 bg-chateau-700 hover:bg-chateau-700 text-white rounded-xl text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <span>กำลังเข้าสู่ระบบ...</span>
              </>
            ) : (
              <>
                <span>เข้าสู่ระบบ</span>
              </>
            )}
          </button>
        </form>

        {/* Admin Contact */}
        <div className="mt-8 p-4 bg-white border border-gray-200 shadow-sm rounded-xl">
          <p className="text-center text-sm text-gray-800">
            <strong>ยังไม่มีบัญชี?</strong><br />
            <span className="text-gray-700">ติดต่อผู้ดูแลระบบเพื่อสร้างบัญชีผู้ใช้</span>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            โดยการเข้าสู่ระบบ คุณยอมรับ{' '}
            <a href="#" className="text-gray-800 hover:text-black font-medium">
              เงื่อนไขการให้บริการ
            </a>{' '}
            และ{' '}
            <a href="#" className="text-gray-800 hover:text-black font-medium">
              นโยบายความเป็นส่วนตัว
            </a>
          </p>
        </div>
      </div>

      {/* Copyright */}
      <div className="mt-6 text-center text-xs text-gray-500">
        © 2025 CHATEAU PLATFORM. All rights reserved.
      </div>
    </div>
  )
}

export default LoginFormSimple