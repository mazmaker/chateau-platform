import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  "https://pqnjvcbmnatrtvpqnrdx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4"
)

async function testUpdate() {
  try {
    console.log("🧪 Testing password_set_at update...")

    // Test with a temporary password user  
    const testEmail = "sales@chateau.com"
    
    // First get the user
    const { data: user, error: getUserError } = await supabaseAdmin
      .from("users")
      .select("id, email, password_set_at")
      .eq("email", testEmail)
      .single()

    if (getUserError) {
      console.error("❌ Error getting user:", getUserError.message)
      return
    }

    console.log("👤 User found:", user)
    console.log("🔒 Current password_set_at:", user.password_set_at)

    // Try to update password_set_at
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        password_set_at: new Date().toISOString()
      })
      .eq("id", user.id)

    if (updateError) {
      console.error("❌ Update failed:", updateError.message)
      console.error("Error details:", updateError)
    } else {
      console.log("✅ Update successful!")
      
      // Verify the update
      const { data: updatedUser, error: verifyError } = await supabaseAdmin
        .from("users")
        .select("password_set_at")
        .eq("id", user.id)
        .single()

      if (verifyError) {
        console.error("❌ Verify failed:", verifyError.message)
      } else {
        console.log("✅ Verified - new password_set_at:", updatedUser.password_set_at)
      }
    }

  } catch (error) {
    console.error("❌ Error:", error.message)
  }
}

testUpdate()
