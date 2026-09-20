import os
import tempfile
from pathlib import Path

from fastapi import (
    FastAPI,
    File,
    UploadFile,
    HTTPException
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from ai.predict import predictor


# ==========================================
# FASTAPI APPLICATION
# ==========================================

app = FastAPI(
    title="Skin Lesion Classification API",
    version="1.0.0"
)


# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# FRONTEND PATH
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_DIR = BASE_DIR / "frontend"


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "service": "Skin Lesion Classification API"
    }


# ==========================================
# PREDICTION API
# ==========================================

@app.post("/predict")
async def predict(
    file: UploadFile = File(...)
):

    # --------------------------------------
    # Validate file
    # --------------------------------------

    ext = Path(
        file.filename or ""
    ).suffix.lower()

    allowed_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".bmp",
        ".webp"
    }

    if ext not in allowed_extensions:

        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Please upload JPG, JPEG, PNG, BMP or WEBP."
        )

    # --------------------------------------
    # Read uploaded image
    # --------------------------------------

    data = await file.read()

    if not data:

        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    # --------------------------------------
    # Temporary file
    # --------------------------------------

    temp_path = None

    try:

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=ext
        ) as temp_file:

            temp_file.write(data)

            temp_path = temp_file.name

        # ----------------------------------
        # AI Prediction
        # ----------------------------------

        result = predictor.predict(temp_path)

        # ----------------------------------
        # API Response
        # ----------------------------------

        return {
            "success": True,
            "predicted_class": result["prediction"],
            "confidence_percent": result["confidence"],
            "note": (
                "Research classification output; "
                "not a medical diagnosis."
            )
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

    finally:

        # ----------------------------------
        # Delete temporary image
        # ----------------------------------

        if temp_path:

            try:
                os.remove(temp_path)

            except OSError:
                pass


# ==========================================
# FRONTEND
# ==========================================

if FRONTEND_DIR.exists():

    app.mount(
        "/static",
        StaticFiles(
            directory=FRONTEND_DIR
        ),
        name="static"
    )


@app.get("/")
def home():

    index_file = FRONTEND_DIR / "index.html"

    if not index_file.exists():

        return {
            "message": "Frontend not found.",
            "api": "/docs"
        }

    return FileResponse(index_file)