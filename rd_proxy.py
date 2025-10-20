# rd_proxy.py
import os, sys, json, time, argparse
from realitydefender import RealityDefender

def map_verdict(status: str):
  s = (status or "").upper()
  if s == "AUTHENTIC": return "real"
  if s == "MANIPULATED": return "fake"
  return "inconclusive"

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--file", required=True)
  args = ap.parse_args()

  key = os.environ.get("RD_API_KEY")
  if not key:
    print(json.dumps({"ok": False, "error": "NO_RD_API_KEY"}))
    sys.exit(1)

  client = RealityDefender(api_key=key)
  t0 = time.time()
  try:
    res = client.detect_file(args.file)
  except Exception as e:
    print(json.dumps({"ok": False, "error": f"{e.__class__.__name__}: {e}"}))
    sys.exit(2)

  out = {
    "ok": True,
    "request_id": res.get("request_id"),
    "status": res.get("status"),
    "verdict": map_verdict(res.get("status")),
    "confidence": res.get("score"),
    "elapsed_ms": int((time.time() - t0) * 1000),
    "models": res.get("models", []),
    "raw": res,
  }
  print(json.dumps(out, ensure_ascii=False))

if __name__ == "__main__":
  main()