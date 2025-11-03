import requests
import json
import sys

API_BASE = "http://100.93.172.21:5112"

def test_health():
    print("Testing /health endpoint...")
    response = requests.get(f"{API_BASE}/health")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print()

def test_companies():
    print("Testing /companies endpoint...")
    response = requests.get(f"{API_BASE}/companies")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print()

def test_company_predictions(company):
    print(f"Testing /predictions/{company} endpoint...")
    response = requests.get(f"{API_BASE}/predictions/{company}")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Company: {data['company']}")
    print(f"Count: {data['count']}")
    if data['count'] > 0:
        print("Sample predictions:")
        for i, (ts, pred) in enumerate(list(data['predictions'].items())[:3]):
            print(f"  {ts}: {pred}")
    print()

def test_specific_timestamp(company, timestamp):
    print(f"Testing /predictions/{company}/{timestamp} endpoint...")
    response = requests.get(f"{API_BASE}/predictions/{company}/{timestamp}")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(json.dumps(response.json(), indent=2))
    else:
        print(response.json())
    print()

def test_batch_predictions(companies):
    print(f"Testing /predictions/batch/multiple endpoint...")
    params = {'companies': companies}
    response = requests.get(f"{API_BASE}/predictions/batch/multiple", params=params)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Companies requested: {data['companies_requested']}")
    for company, info in data['results'].items():
        print(f"  {company}: {info['count']} predictions")
    print()

def main():
    if len(sys.argv) > 1:
        api_base = sys.argv[1]
        global API_BASE
        API_BASE = api_base
    
    print("=" * 80)
    print("LIVE PREDICTION API TESTS")
    print(f"API Base: {API_BASE}")
    print("=" * 80)
    print()
    
    try:
        test_health()
        
        test_companies()
        
        test_company_predictions("ICICIBANK")
        
        test_specific_timestamp("ICICIBANK", "2025-10-30 09:25")
        
        test_batch_predictions(["AXISBANK", "ICICIBANK"])
        
        print("=" * 80)
        print("ALL TESTS COMPLETED")
        print("=" * 80)
        
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to API. Make sure the service is running.")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    main()