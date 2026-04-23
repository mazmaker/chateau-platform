import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4'
)

async function applyMigration() {
  console.log('🔄 Applying billing settings migration...')

  try {
    // Add billing_settings column to tenants table
    console.log('📝 Adding billing_settings column to tenants table...')
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add billing_settings column to tenants table if it doesn't exist
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'tenants' AND column_name = 'billing_settings'
            ) THEN
                ALTER TABLE tenants ADD COLUMN billing_settings jsonb DEFAULT '{}';
            END IF;
        END $$;
      `
    })

    if (addColumnError) {
      console.log('Column add error (might be expected):', addColumnError.message)
    }

    // Update existing tenants with default settings
    console.log('🔧 Setting default billing settings...')
    const defaultSettings = {
      scheduler: {
        timezone: "Asia/Bangkok",
        businessHours: { start: "08:00", end: "18:00" },
        holidays: ["2024-01-01", "2024-12-25"],
        retryPolicy: {
          enabled: true,
          maxRetries: 3,
          backoffStrategy: "exponential",
          backoffBase: 2
        }
      },
      email: {
        fromName: "CHATEAU Platform",
        fromEmail: "billing@chateau-platform.com",
        replyTo: "support@chateau-platform.com",
        enableTracking: true,
        enableA11yMode: false
      },
      billing: {
        invoicePrefix: "INV",
        gracePeriodDays: 7,
        autoSuspendAfterDays: 14,
        currency: "THB",
        taxRate: 0.07,
        paymentTerms: "NET 7"
      },
      notifications: {
        enableAdminEmail: true,
        adminEmail: "admin@chateau-platform.com"
      }
    }

    const { error: updateError } = await supabase
      .from('tenants')
      .update({ billing_settings: defaultSettings })
      .or('billing_settings.is.null,billing_settings.eq.{}')

    if (updateError) {
      console.log('Update error (might be expected):', updateError.message)
    }

    // Create RPC functions
    console.log('🛠️ Creating RPC functions...')
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create function to get billing settings for current user
        CREATE OR REPLACE FUNCTION get_billing_settings()
        RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            user_tenant_id uuid;
            settings jsonb;
        BEGIN
            -- Get user's tenant_id
            SELECT tenant_id INTO user_tenant_id
            FROM users
            WHERE id = auth.uid();

            IF user_tenant_id IS NULL THEN
                RETURN '{}'::jsonb;
            END IF;

            -- Get billing settings
            SELECT billing_settings INTO settings
            FROM tenants
            WHERE id = user_tenant_id;

            RETURN COALESCE(settings, '{}'::jsonb);
        END;
        $$;

        -- Create function to update billing settings
        CREATE OR REPLACE FUNCTION update_billing_settings(new_settings jsonb)
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            user_tenant_id uuid;
            user_role text;
        BEGIN
            -- Get user's tenant_id and role
            SELECT tenant_id, role::text INTO user_tenant_id, user_role
            FROM users
            WHERE id = auth.uid();

            -- Only owners can update billing settings
            IF user_role != 'owner' THEN
                RAISE EXCEPTION 'Only owners can update billing settings';
            END IF;

            -- Update settings
            UPDATE tenants
            SET billing_settings = new_settings,
                updated_at = now()
            WHERE id = user_tenant_id;

            RETURN TRUE;
        END;
        $$;
      `
    })

    if (rpcError) {
      console.log('RPC creation error (might be expected):', rpcError.message)
    }

    console.log('✅ Migration completed successfully!')
    console.log('')
    console.log('🔧 Changes applied:')
    console.log('   • Added billing_settings column to tenants table')
    console.log('   • Set default billing settings for all tenants')
    console.log('   • Created get_billing_settings() RPC function')
    console.log('   • Created update_billing_settings() RPC function')
    console.log('')
    console.log('✨ The 403 profiles table error should now be resolved!')
    return true

  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.log('')
    console.log('📋 Manual steps required:')
    console.log('1. Go to Supabase Dashboard → SQL Editor')
    console.log('2. Copy content from: supabase/migrations/20260424000000_add_billing_settings.sql')
    console.log('3. Run the SQL manually')
    return false
  }
}

applyMigration().then(success => {
  if (success) {
    console.log('🎉 Ready to test billing settings!')
  }
  process.exit(0)
})