
import sqlite3
import json

db_path = r'C:\Users\pedro\OneDrive\APPS\GitHub\odoo-universal-importer\server\data\importer.db'
print(f"Checking DB at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Inspect the specific LIVE job from the screenshot
    live_job_id = "9bb3a892-c74d-44d4-8db7-d8a13bed30d4"
    print(f"\n[INFO] Inspecting JOB Table for: {live_job_id}")
    
    job = cursor.execute("SELECT status, progress, counters_json FROM ce_jobs WHERE id = ?", (live_job_id,)).fetchone()
    
    if job:
        print(f"   [JOB] Status: {job[0]}")
        print(f"   [JOB] Progress: {job[1]}")
        print(f"   [JOB] Counters: {job[2]}")
    else:
        print("   [WARN] Job not found in ce_jobs table.")

    # Count items in job
    job_items_count = cursor.execute("SELECT count(*) FROM ce_job_items WHERE job_id = ?", (live_job_id,)).fetchone()[0]
    print(f"   [STATS] Total Job Items (SKUs): {job_items_count}")

    # Count unique URLs found in this job
    unique_urls = cursor.execute("SELECT count(DISTINCT product_url) FROM ce_job_items WHERE job_id = ?", (live_job_id,)).fetchone()[0]
    print(f"   [STATS] Unique URLs (Web Catalog Pages): {unique_urls}")

    # Verify what's in ce_web_products from this job "batch" (approximately, by time or if we linked job_id)
    # ce_web_products might not have job_id if it's a global catalog, but let's check if my previous edits added it.
    # The schema showed: job_id TEXT -- Link to Bulk Job.
    
    web_prods_count = cursor.execute("SELECT count(*) FROM ce_web_products WHERE job_id = ?", (live_job_id,)).fetchone()[0]
    print(f"   [STATS] Entries in ce_web_products for this Job: {web_prods_count}")

    conn.close()
except Exception as e:
    print(f"Debug Error: {e}")
