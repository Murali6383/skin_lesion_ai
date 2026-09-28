import os
import json
import tempfile
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()

from fastapi import (
    FastAPI,
    File,
    UploadFile,
    Form,
    HTTPException
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse

from groq import Groq

from ai.predict import predictor


# =========================================================
# GROQ CONFIGURATION
# =========================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GROQ_MODEL = "openai/gpt-oss-20b"

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY is not set.")


groq_client = Groq(
    api_key=GROQ_API_KEY
)


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="SkinGuardian AI + Groq",
    version="3.0.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# PROJECT PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_DIR = BASE_DIR / "frontend"

FRONTEND_DIST = FRONTEND_DIR / "dist"


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "service": "SkinGuardian AI + Groq",
        "groq_model": GROQ_MODEL,
        "groq_configured": bool(GROQ_API_KEY)
    }


# =========================================================
# GROQ TEST
# =========================================================

@app.get("/groq-test")
def groq_test():

    if not GROQ_API_KEY:

        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured."
        )

    try:

        response = groq_client.chat.completions.create(

            model=GROQ_MODEL,

            messages=[
                {
                    "role": "user",
                    "content": (
                        "Say hello and confirm that "
                        "you are running through Groq."
                    )
                }
            ],

            max_completion_tokens=50,

            include_reasoning=False
        )

        return {
            "success": True,
            "model": GROQ_MODEL,
            "response": (
                response
                .choices[0]
                .message
                .content
            )
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Groq connection failed: {str(e)}"
        )


# =========================================================
# IMAGE VALIDATION
# =========================================================

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp"
}


def validate_image(filename):

    ext = Path(
        filename or ""
    ).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported image format. "
                "Please upload JPG, JPEG, PNG, BMP or WEBP."
            )
        )

    return ext


# =========================================================
# PREDICTION API
# =========================================================

@app.post("/predict")
async def predict(
    file: UploadFile = File(...)
):

    ext = validate_image(file.filename)

    data = await file.read()

    if not data:

        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    temp_path = None

    try:

        # -------------------------------------------------
        # SAVE IMAGE TEMPORARILY
        # -------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=ext
        ) as temp_file:

            temp_file.write(data)

            temp_path = temp_file.name


        # -------------------------------------------------
        # RUN SKIN LESION ML MODEL
        # -------------------------------------------------

        result = predictor.predict(
            temp_path
        )


        return {

            "success": True,

            "predicted_class":
                result["prediction"],

            "confidence_percent":
                result["confidence"],

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

        if temp_path:

            try:
                os.remove(temp_path)

            except OSError:
                pass


# =========================================================
# SYSTEM PROMPT
# =========================================================

SYSTEM_PROMPT = """

You are SkinGuardian AI, a medical information
assistant integrated into a skin lesion AI
screening application.

A separate machine learning image classification
model has analyzed the uploaded skin lesion image.

The classification result is provided to you only
as contextual information.

IMPORTANT RESPONSE RULES:

1. ALWAYS answer the user's CURRENT PROMPT directly.

2. The CURRENT USER PROMPT is the primary instruction.

3. Use the previous AI prediction ONLY when it is
   relevant to the user's current question.

4. Do NOT automatically repeat the predicted disease,
   confidence, symptoms, precautions, or treatment.

5. Do NOT generate the same disease explanation
   for every user message.

6. If the user says:
   "hi", "hello", "hii", "hey", or "thanks",
   respond naturally and briefly.
   Do not provide a disease explanation.

7. If the user asks:
   "what disease is this?"
   explain the AI predicted condition and confidence.
   Clearly state that the prediction is NOT a confirmed
   medical diagnosis.

8. If the user asks:
   "why did this disease come?"
   explain possible causes and risk factors related
   to the predicted condition.

9. If the user asks about symptoms,
   explain only the relevant symptoms.

10. If the user asks about treatment,
    explain general treatment approaches only.

11. If the user asks for drugs, medicines, tablets,
    prescriptions, or dosage:
    do NOT prescribe medicines or provide dosage.
    Explain that a qualified dermatologist should
    confirm the condition and decide the appropriate
    treatment.

12. If the user asks an unrelated question,
    answer that question directly instead of forcing
    the previous skin prediction into the response.

13. The AI prediction is NOT a confirmed diagnosis.

14. Provide general medical information only.

15. Do not claim certainty.

16. Do not personally diagnose the patient.

17. Do not analyze the uploaded image yourself.

18. Do not say that you personally examined the image.

19. Do not tell the user to start or stop medication.

20. Recommend consultation with a qualified dermatologist
    when medically appropriate.

21. Use simple and clear language.

22. Keep answers concise and directly related
    to the user's current question.

23. Use bullet points only when they improve clarity.

24. Never invent patient information.

25. For follow-up questions, use the previous prediction
    only when it is relevant to the current prompt.

"""


# =========================================================
# CHAT API
#
# FIRST MESSAGE:
# Image -> ML prediction -> Groq
#
# FOLLOW-UP:
# Existing prediction -> Groq only
#
# RESPONSE:
# NDJSON streaming
#
# EVENT TYPES:
# prediction
# token
# done
# error
# =========================================================

@app.post("/chat")
async def chat(

    file: Optional[UploadFile] = File(None),

    prompt: str = Form(...),

    first_message: bool = Form(True),

    previous_disease: str = Form(""),

    previous_confidence: str = Form("")

):

    # =====================================================
    # VALIDATE PROMPT
    # =====================================================

    if not prompt.strip():

        raise HTTPException(
            status_code=400,
            detail="Please enter a question or prompt."
        )


    # =====================================================
    # CHECK GROQ
    # =====================================================

    if not GROQ_API_KEY:

        raise HTTPException(
            status_code=500,
            detail=(
                "GROQ_API_KEY is missing. "
                "Please configure the environment variable."
            )
        )


    disease = ""

    confidence = 0.0

    temp_path = None


    try:

        # =================================================
        # FIRST MESSAGE
        # =================================================

        if first_message:

            # ---------------------------------------------
            # VALIDATE IMAGE
            # ---------------------------------------------

            if file is None:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Image file is required "
                        "for the first message."
                    )
                )


            ext = validate_image(
                file.filename
            )


            data = await file.read()


            if not data:

                raise HTTPException(
                    status_code=400,
                    detail="Uploaded image is empty."
                )


            # ---------------------------------------------
            # SAVE IMAGE
            # ---------------------------------------------

            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=ext
            ) as temp_file:

                temp_file.write(data)

                temp_path = temp_file.name


            # ---------------------------------------------
            # RUN ML PREDICTION
            # ---------------------------------------------

            result = predictor.predict(
                temp_path
            )


            disease = result["prediction"]

            confidence = float(
                result["confidence"]
            )


        # =================================================
        # FOLLOW-UP MESSAGE
        # =================================================

        else:

            # ---------------------------------------------
            # DO NOT RUN ML AGAIN
            # ---------------------------------------------

            if not previous_disease.strip():

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Previous prediction information "
                        "was not provided."
                    )
                )


            disease = previous_disease.strip()


            # ---------------------------------------------
            # PREVIOUS CONFIDENCE
            # ---------------------------------------------

            try:

                confidence = float(
                    previous_confidence
                    if previous_confidence
                    else 0
                )

            except ValueError:

                confidence = 0.0


        # =================================================
        # USER MESSAGE
        # =================================================

        user_message = f"""

Previous AI Skin Lesion Prediction:
{disease}

AI Confidence:
{confidence:.2f}%

CURRENT USER PROMPT:
{prompt}

IMPORTANT:

Answer the CURRENT USER PROMPT directly.

Use the previous AI prediction only when it is
relevant to the current prompt.

Do not automatically repeat the disease,
confidence, symptoms, precautions, or treatment.

Do not answer questions that the user did not ask.

The AI prediction is not a confirmed diagnosis.

"""


        # =================================================
        # SEND PREDICTION EVENT
        # =================================================

        async def generate():

            try:

                # -----------------------------------------
                # PREDICTION EVENT
                # -----------------------------------------

                yield (
                    json.dumps(
                        {
                            "type": "prediction",

                            "disease": disease,

                            "confidence": confidence,

                            "prediction_performed":
                                first_message
                        }
                    )
                    + "\n"
                )


                # -----------------------------------------
                # GROQ STREAM
                # -----------------------------------------

                stream = (
                    groq_client
                    .chat
                    .completions
                    .create(

                        model=GROQ_MODEL,

                        messages=[

                            {
                                "role":
                                    "system",

                                "content":
                                    SYSTEM_PROMPT
                            },

                            {
                                "role":
                                    "user",

                                "content":
                                    user_message
                            }

                        ],

                        temperature=0.2,

                        max_completion_tokens=400,

                        include_reasoning=False,

                        stream=True
                    )
                )


                # -----------------------------------------
                # SEND TOKENS
                # -----------------------------------------

                for chunk in stream:

                    if not chunk.choices:

                        continue


                    delta = (
                        chunk
                        .choices[0]
                        .delta
                    )


                    content = (
                        delta.content
                        if delta
                        else None
                    )


                    if content:

                        yield (
                            json.dumps(
                                {
                                    "type":
                                        "token",

                                    "content":
                                        content
                                }
                            )
                            + "\n"
                        )


                # -----------------------------------------
                # DONE
                # -----------------------------------------

                yield (
                    json.dumps(
                        {
                            "type": "done"
                        }
                    )
                    + "\n"
                )


            except Exception as e:

                yield (
                    json.dumps(
                        {
                            "type":
                                "error",

                            "message":
                                str(e)
                        }
                    )
                    + "\n"
                )


        # =================================================
        # RETURN STREAM
        # =================================================

        return StreamingResponse(

            generate(),

            media_type="application/x-ndjson",

            headers={
                "Cache-Control":
                    "no-cache",

                "X-Accel-Buffering":
                    "no"
            }
        )


    except HTTPException:

        raise


    except Exception as e:

        raise HTTPException(

            status_code=500,

            detail=(
                "AI + Groq processing failed: "
                f"{str(e)}"
            )
        )


    finally:

        # =================================================
        # DELETE TEMP IMAGE
        # =================================================

        if temp_path:

            try:

                os.remove(
                    temp_path
                )

            except OSError:

                pass


# =========================================================
# FRONTEND
# =========================================================

# Development:
# http://localhost:5173
#
# Production:
# frontend/dist


if FRONTEND_DIST.exists():

    assets_dir = FRONTEND_DIST / "assets"

    if assets_dir.exists():

        app.mount(

            "/assets",

            StaticFiles(
                directory=assets_dir
            ),

            name="assets"
        )


# =========================================================
# FRONTEND HOME
# =========================================================

@app.get("/")
async def home():

    index_file = (
        FRONTEND_DIST
        / "index.html"
    )


    if index_file.exists():

        return FileResponse(
            index_file
        )


    # ---------------------------------------------
    # NORMAL FRONTEND INDEX.HTML
    # ---------------------------------------------

    normal_index = (
        FRONTEND_DIR
        / "index.html"
    )


    if normal_index.exists():

        return FileResponse(
            normal_index
        )


    return {

        "message":
            "Frontend build not found.",

        "solution":
            "Run npm run build inside frontend folder.",

        "api_docs":
            "/docs"
    }


# =========================================================
# SPA FALLBACK
# =========================================================

@app.get("/{full_path:path}")
async def frontend_fallback(
    full_path: str
):

    # ---------------------------------------------
    # API / DOCUMENTATION PATHS
    # ---------------------------------------------

    if full_path.startswith("docs"):

        raise HTTPException(
            status_code=404,
            detail="Not found"
        )


    if full_path.startswith("openapi.json"):

        raise HTTPException(
            status_code=404,
            detail="Not found"
        )


    if full_path.startswith("health"):

        raise HTTPException(
            status_code=404,
            detail="Not found"
        )


    if full_path.startswith("groq-test"):

        raise HTTPException(
            status_code=404,
            detail="Not found"
        )


    if full_path.startswith("predict"):

        raise HTTPException(
            status_code=404,
            detail="Not found"
        )


    if full_path.startswith("chat"):

        raise HTTPException(
            status_code=404,
            detail="Not found"
        )


    # ---------------------------------------------
    # SERVE REACT APP
    # ---------------------------------------------

    index_file = (
        FRONTEND_DIST
        / "index.html"
    )


    if index_file.exists():

        return FileResponse(
            index_file
        )


    raise HTTPException(
        status_code=404,
        detail="Frontend not found"
    )