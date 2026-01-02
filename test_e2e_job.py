
import requests
import time
import json

base_url = 'http://localhost:4000/api/catalog-enricher'
payload = {
    "pricelistId": "652d959-7acd-401a-8c6e-78a84bd875f8",
    "skuColumn": "PrintConfigCode",
    "profileId": "a56b5943-953d-4879-9936-719cdf35ad29"
}

print("🚀 Starting E2E Test: Targeted Enrichment (Python)...")

try:
    # 1. Start Job
    print("Step 1: POST /merger/targeted-enrichment")
    r = requests.post(f"{base_url}/merger/targeted-enrichment", json=payload)
    print(f"Status Code: {r.status_code}")
    print(f"Response: {r.text}")
    
    data = r.json()
    job_id = data.get('jobId')
    
    if not job_id:
        print("❌ FAILURE: No jobId returned!")
        exit(1)

    # 2. Poll Active Jobs
    print(f"\nStep 2: GET /crawler/active-jobs (Poll 1)")
    r_poll = requests.get(f"{base_url}/crawler/active-jobs")
    print(f"Active Jobs count: {len(r_poll.json().get('jobs', []))}")
    print(f"Active Jobs: {json.dumps(r_poll.json().get('jobs', []), indent=2)}")

    jobs = r_poll.json().get('jobs', [])
    job_found = any(j['id'] == job_id for j in jobs)

    if job_found:
        print("✅ SUCCESS: Job found in active list!")
    else:
        print("❌ FAILURE: Job NOT found in active list immediately after creation.")
        
        # Wait 2 seconds and retry
        print("\nWaiting 2s for retry...")
        time.sleep(2)
        
        print("Step 3: GET /crawler/active-jobs (Poll 2)")
        r_poll2 = requests.get(f"{base_url}/crawler/active-jobs")
        jobs2 = r_poll2.json().get('jobs', [])
        job_found2 = any(j['id'] == job_id for j in jobs2)
        
        if job_found2:
            print("✅ SUCCESS: Job found in active list on retry!")
        else:
            print("❌ CRITICAL: Job still missing after 2 seconds.")

except Exception as e:
    print(f"Test Error: {e}")
