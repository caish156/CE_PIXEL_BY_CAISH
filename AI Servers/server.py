import uvicorn

from insightface_engine import app


if __name__ == "__main__":

    print("=" * 60)
    print("       PIXEL BY CAISH AI SERVER")
    print("=" * 60)
    print()
    print("🚀 Starting InsightFace AI Server...")
    print("🌐 http://127.0.0.1:8000")
    print()
    print("📡 Endpoints:")
    print("   GET  /")
    print("   GET  /ping")
    print("   POST /heartbeat")
    print("   POST /shutdown")
    print("   POST /get-skin-anchor")
    print()
    print("=" * 60)

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000
    )