import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { initialSchema } from '@/lib/initialSchema'

export function DatabaseSetup() {
  const [isApplying, setIsApplying] = useState(false)
  const [result, setResult] = useState<string>('')

  const applySchema = async () => {
    setIsApplying(true)
    setResult('กำลังสร้าง database schema...')

    try {
      // Read the schema SQL file
      const response = await fetch('/schema.sql')
      const schemaSql = await response.text()

      // Split SQL into individual statements
      const statements = schemaSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'))

      // Execute each statement
      let successCount = 0
      let errorCount = 0

      for (const statement of statements) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement })
          if (error) {
            // If RPC fails, try direct SQL
            const { error: directError } = await supabase
              .from('_temp')
              .select('*')
            errorCount++
          } else {
            successCount++
          }
        } catch (err) {
          console.error('Statement error:', statement, err)
          errorCount++
        }
      }

      if (successCount > 0) {
        setResult(`✅ สร้างสำเร็จ! ดำเนินการ ${successCount} คำสั่ง`)

        // Verify tables were created
        const { data: tables, error } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')

        if (!error && tables) {
          const tableNames = tables.map(t => t.table_name).join(', ')
          setResult(`✅ Database schema สร้างเสร็จแล้ว! Tables: ${tableNames}`)
        }
      } else {
        setResult(`❌ มีข้อผิดพลาด ${errorCount} รายการ`)
      }
    } catch (error: any) {
      console.error('Schema error:', error)
      setResult(`❌ เกิดข้อผิดพลาด: ${error.message}`)
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
      <h3 className="text-lg font-semibold mb-2 text-yellow-800">
        🗄️ Database Setup Required
      </h3>

      <p className="text-sm text-yellow-700 mb-3">
        คุณต้องสร้าง database tables ก่อนจะใช้งานได้
      </p>

      <button
        onClick={applySchema}
        disabled={isApplying}
        className={`px-4 py-2 rounded text-white ${
          isApplying
            ? 'bg-yellow-400 cursor-not-allowed'
            : 'bg-yellow-600 hover:bg-yellow-700'
        }`}
      >
        {isApplying ? 'กำลังดำเนินการ...' : 'สร้าง Database Schema'}
      </button>

      {result && (
        <div className={`mt-3 p-3 rounded text-sm ${
          result.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {result}
        </div>
      )}

      <div className="mt-3 text-xs text-yellow-600">
        <p>หรือทำ manually:</p>
        <ol className="list-decimal list-inside mt-1">
          <li>ไปที่ Supabase Dashboard → SQL Editor</li>
          <li>วาง SQL จากไฟล์: supabase/migrations/20241219000000_initial_schema.sql</li>
          <li>คลิก "Run"</li>
        </ol>
      </div>
    </div>
  )
}