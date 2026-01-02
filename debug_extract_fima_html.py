
import urllib.request
import re

url = 'https://fimacf.com/?s=F3111/1&post_type=product'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

print(f"Fetching: {url}")
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
        print("\n--- IMAGE TAGS ---")
        img_tags = re.findall(r'<img[^>]+>', html)
        for img in img_tags:
            print(img)
            
        print("\n--- OG:IMAGE ---")
        og_img = re.search(r'property="og:image"\s+content="([^"]+)"', html)
        if og_img:
            print(f"Found OG:IMAGE: {og_img.group(1)}")
        else:
            print("OG:IMAGE not found in HTML")
            
        print("\n--- JSON-LD ---")
        json_lds = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
        for jld in json_lds:
            if '"image"' in jld:
                print("Found Image in JSON-LD")
                # print(jld[:200] + "...")
                
except Exception as e:
    print(f"Error: {e}")
