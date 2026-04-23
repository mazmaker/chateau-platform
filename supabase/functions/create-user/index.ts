import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const { email, password, fullName, tenantId, role, isActive } = await req.json();

    // Create user using Supabase Admin API
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Create user in auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        tenant_id: tenantId,
        role
      },
      app_metadata: {
        provider: 'email',
        role
      }
    });

    if (userError) {
      return new Response(JSON.stringify({
        success: false,
        error: userError.message
      }), { status: 400 });
    }

    // 2. Create user in public.users
    const { error: dbError } = await supabase
      .from('users')
      .insert({
        id: userData.user.id,
        email,
        full_name: fullName,
        tenant_id: tenantId,
        role,
        is_active: isActive ?? true
      });

    if (dbError) {
      // Rollback: delete from auth.users
      await supabase.auth.admin.deleteUser(userData.user.id);

      return new Response(JSON.stringify({
        success: false,
        error: dbError.message
      }), { status: 400 });
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: userData.user.id
    }));

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
});
