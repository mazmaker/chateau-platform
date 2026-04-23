// Debug Script สำหรับทดสอบ Status Change Modal
// Paste ใน Browser Console (F12) เพื่อ debug

console.log("🔍 Starting Status Modal Debug...");

// 1. เช็ค Supabase connection
if (typeof supabase !== 'undefined') {
    console.log("✅ Supabase available");

    // ทดสอบ authentication
    supabase.auth.getUser().then(({ data: { user }, error }) => {
        if (error) {
            console.error("❌ Auth error:", error);
        } else if (user) {
            console.log("✅ User authenticated:", user.email);
        } else {
            console.warn("⚠️ No user logged in");
        }
    });
} else {
    console.error("❌ Supabase not found");
}

// 2. เช็ค invoice data
const testInvoiceUpdate = async () => {
    console.log("🔬 Testing invoice update...");

    try {
        // ดึงรายการ invoices
        const { data: invoices, error: fetchError } = await supabase
            .from('invoices')
            .select('*')
            .limit(1);

        if (fetchError) {
            console.error("❌ Fetch error:", fetchError);
            return;
        }

        if (!invoices || invoices.length === 0) {
            console.warn("⚠️ No invoices found");
            return;
        }

        const testInvoice = invoices[0];
        console.log("✅ Test invoice found:", testInvoice.invoice_number);

        // ทดสอบการอัพเดท (เปลี่ยน updated_at)
        const { error: updateError } = await supabase
            .from('invoices')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', testInvoice.id);

        if (updateError) {
            console.error("❌ Update error:", updateError);
            console.error("Possible causes:");
            console.error("- RLS Policy blocking update");
            console.error("- User not associated with tenant");
            console.error("- Missing permissions");
        } else {
            console.log("✅ Update successful!");
        }

    } catch (error) {
        console.error("❌ Test failed:", error);
    }
};

// 3. เช็ค profiles และ tenant association
const checkUserTenant = async () => {
    console.log("👤 Checking user-tenant association...");

    try {
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select(`
                *,
                tenants (name, slug)
            `);

        if (error) {
            console.error("❌ Profiles error:", error);
        } else {
            console.log("👤 User profiles:", profiles);
        }
    } catch (error) {
        console.error("❌ Profile check failed:", error);
    }
};

// 4. เช็ค logs table
const testLogging = async () => {
    console.log("📋 Testing logging functionality...");

    try {
        // ทดสอบการเขียน log
        const { data: invoices } = await supabase
            .from('invoices')
            .select('id, tenant_id, status')
            .limit(1);

        if (invoices && invoices.length > 0) {
            const testInvoice = invoices[0];

            const { error: logError } = await supabase
                .from('invoice_status_logs')
                .insert({
                    invoice_id: testInvoice.id,
                    tenant_id: testInvoice.tenant_id,
                    old_status: 'pending',
                    new_status: 'paid',
                    changed_by: 'DEBUG_TEST',
                    change_type: 'manual',
                    reason: 'Debug test log'
                });

            if (logError) {
                console.error("❌ Logging error:", logError);
            } else {
                console.log("✅ Logging works!");
            }
        }
    } catch (error) {
        console.error("❌ Logging test failed:", error);
    }
};

// รันทุก tests
const runAllTests = async () => {
    await testInvoiceUpdate();
    await checkUserTenant();
    await testLogging();
    console.log("🏁 Debug complete! Check messages above for issues.");
};

// Auto-run หากไม่มี errors
console.log("🚀 Running debug tests...");
runAllTests().catch(console.error);

// Helper: ให้ user รันคำสั่งเพิ่มเติม
console.log(`
📋 Manual Debug Commands:
- testInvoiceUpdate() - ทดสอบการอัพเดท invoice
- checkUserTenant() - เช็ค user-tenant association
- testLogging() - ทดสอบ logging system
- runAllTests() - รันทุกอย่าง
`);