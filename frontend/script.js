const imageInput =
    document.getElementById("imageInput");

const fileName =
    document.getElementById("fileName");

const imagePreview =
    document.getElementById("imagePreview");

const previewContainer =
    document.getElementById("previewContainer");

const predictBtn =
    document.getElementById("predictBtn");

const loading =
    document.getElementById("loading");

const result =
    document.getElementById("result");

const error =
    document.getElementById("error");

const prediction =
    document.getElementById("prediction");

const confidence =
    document.getElementById("confidence");

const confidenceFill =
    document.getElementById("confidenceFill");


let selectedFile = null;


// ==========================================
// IMAGE SELECTION
// ==========================================

imageInput.addEventListener(
    "change",
    function () {

        const file = this.files[0];

        if (!file) {

            selectedFile = null;

            predictBtn.disabled = true;

            previewContainer.classList.add(
                "hidden"
            );

            fileName.textContent =
                "No image selected";

            return;
        }


        // Check image type

        if (!file.type.startsWith("image/")) {

            showError(
                "Please select a valid image file."
            );

            predictBtn.disabled = true;

            return;
        }


        selectedFile = file;

        fileName.textContent =
            file.name;

        predictBtn.disabled = false;


        // Preview

        const reader =
            new FileReader();

        reader.onload = function (event) {

            imagePreview.src =
                event.target.result;

            previewContainer.classList.remove(
                "hidden"
            );
        };

        reader.readAsDataURL(file);


        // Reset previous result

        result.classList.add("hidden");

        error.classList.add("hidden");
    }
);


// ==========================================
// PREDICTION
// ==========================================

predictBtn.addEventListener(
    "click",
    async function () {

        if (!selectedFile) {

            showError(
                "Please select an image first."
            );

            return;
        }


        // Reset UI

        result.classList.add("hidden");

        error.classList.add("hidden");

        loading.classList.remove("hidden");

        predictBtn.disabled = true;


        // FormData

        const formData =
            new FormData();

        formData.append(
            "file",
            selectedFile
        );


        try {

            const response =
                await fetch(
                    "/predict",
                    {
                        method: "POST",
                        body: formData
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    "Prediction failed."
                );
            }


            // ==================================
            // DISPLAY RESULT
            // ==================================

            prediction.textContent =
                data.predicted_class;

            confidence.textContent =
                Number(
                    data.confidence_percent
                ).toFixed(2);


            const confidenceValue =
                Number(
                    data.confidence_percent
                );


            confidenceFill.style.width =
                confidenceValue + "%";


            result.classList.remove(
                "hidden"
            );

        }

        catch (err) {

            showError(
                err.message ||
                "Unable to connect to AI server."
            );

        }

        finally {

            loading.classList.add(
                "hidden"
            );

            predictBtn.disabled = false;
        }
    }
);


// ==========================================
// ERROR DISPLAY
// ==========================================

function showError(message) {

    error.textContent =
        "❌ " + message;

    error.classList.remove(
        "hidden"
    );

    result.classList.add(
        "hidden"
    );
}