
import urllib.request
import urllib.parse
import json
import time

base_url = 'http://localhost:4000/api/catalog-enricher'
payload = {
    "pricelistId": "652d0959-7acd-401a-8c6e-70a04bd875f8",
    "skuColumn": "PrintConfigCode",
    "profileId": "a56b5943-953d-4879-9936-719cdf35ad29"
}

print("Starting E2E Test: Targeted Enrichment (Python urllib)...")

def post_json(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), method='POST')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def get_json(url):
    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode())

try:
    # 1. Start Job
    print("Step 1: POST /merger/targeted-enrichment")
    data = post_json(f"{base_url}/merger/targeted-enrichment", payload)
    print(f"Response: {data}")
    
    job_id = data.get('jobId')
    if not job_id:
        print("❌ FAILURE: No jobId returned!")
        exit(1)

    # 2. Poll Active Jobs
    print(f"\nStep 2: GET /crawler/active-jobs (Poll 1)")
    data_poll = get_json(f"{base_url}/crawler/active-jobs")
    jobs = data_poll.get('jobs', [])
    print(f"Active Jobs count: {len(jobs)}")
    print(f"Active Jobs: {json.dumps(jobs, indent=2)}")

    job_found = any(j['id'] == job_id for j in jobs)

    if job_found:
        print("✅ SUCCESS: Job found in active list!")
    else:
        print("❌ FAILURE: Job NOT found in active list immediately after creation.")
        
        # Wait 2 seconds and retry
        print("\nWaiting 2s for retry...")
        time.sleep(2)
        
        print("Step 3: GET /crawler/active-jobs (Poll 2)")
        data_poll2 = get_json(f"{base_url}/crawler/active-jobs")
        jobs2 = data_poll2.get('jobs', [])
        job_found2 = any(j['id'] == job_id for j in jobs2)
        
        if job_found2:
            print("✅ SUCCESS: Job found in active list on retry!")
        else:
            print("❌ CRITICAL: Job still missing after 2 seconds.")

except Exception as e:
    print(f"Test Error: {e}")
