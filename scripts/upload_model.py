"""Upload trained model_params.json to ml_models table"""
import json
import sys
from supabase import create_client

SUPABASE_URL = "https://pqnjvcbmnatrtvpqnrdx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4"
TENANT_ID = "00000000-0000-0000-0000-000000000001"
MODEL_NAME = "lead_scoring_rf"

def main():
    with open("scripts/model_params.json", "r") as f:
        params = json.load(f)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Get current max version
    res = (sb.table("ml_models")
        .select("version")
        .eq("tenant_id", TENANT_ID)
        .eq("name", MODEL_NAME)
        .order("version", desc=True)
        .limit(1)
        .execute())
    next_version = (res.data[0]["version"] + 1) if res.data else 1

    # Deactivate old versions
    sb.table("ml_models").update({"is_active": False}).eq("tenant_id", TENANT_ID).eq("name", MODEL_NAME).execute()

    # Insert new version as active
    new_row = {
        "tenant_id": TENANT_ID,
        "name": MODEL_NAME,
        "version": next_version,
        "is_active": True,
        "params": params,
    }
    sb.table("ml_models").insert(new_row).execute()

    print(f"OK uploaded version {next_version} (features: {len(params['features'])}, trees: {len(params['trees'])})")

if __name__ == "__main__":
    main()
