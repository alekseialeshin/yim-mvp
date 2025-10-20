# rd_proxy.py
# Тонкий CLI над RealityDefender SDK.
# Вход: --file <path>
# Выход: нормализованный JSON в stdout.
import os, sys, json, time, argparse
from realitydefender import RealityDefender

def map_verdict(status: str):
    s = (status or "").upper()
    if s == "AUTHENTIC": return "real"
    if s == "MANIPULATED": return "fake"
    return "inconclusive"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="path to audio file")
    args = ap.parse_args()

    key = os.environ.get("RD_API_KEY")
    if not key:
        print(json.dumps({"ok": False, "error": "NO_RD_API_KEY"}))
        sys.exit(1)

    cli = RealityDefender(api_key=key)

    t0 = time.time()
    try:
        res = cli.detect_file(args.file)  # SDK сам грузит и ждёт результат
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"{e.__class__.__name__}: {e}"}))
        sys.exit(2)
    elapsed_ms = int((time.time() - t0) * 1000)

    # Пример ответа SDK:
    # { "request_id": "...", "status": "AUTHENTIC|MANIPULATED|INCONCLUSIVE", "score": 0.01, "models": [...] }
    request_id = res.get("request_id")
    rd_status  = res.get("status")
    verdict    = map_verdict(rd_status)
    # Не делаем эвристику над score, просто пробрасываем как confidence
    confidence = res.get("score", None)

    out = {
        "ok": True,
        "request_id": request_id,
        "status": rd_status,
        "verdict": verdict,
        "confidence": confidence,
        "elapsed_ms": elapsed_ms,
        "models": res.get("models", []),
        "raw": res,  # полный ответ SDK
    }
    print(json.dumps(out, ensure_ascii=False))
    sys.exit(0)

if __name__ == "__main__":
    main()