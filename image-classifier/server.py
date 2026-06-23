import os
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image
from flask import Flask, request, jsonify

CHECKPOINT  = os.environ.get("CHECKPOINT", os.path.join(os.path.dirname(__file__), "weighting.pth"))
TASK_NAMES  = ["damage_severity", "informative", "humanitarian", "disaster_types"]
NUM_CLASSES = [3, 2, 4, 7]

app = Flask(__name__)

# ── model ──────────────────────────────────────────────────────────────────
print("Loading model...", flush=True)
_ck = torch.load(CHECKPOINT, map_location="cpu")
class_names = _ck["class_names"]

_model = models.resnet18(weights=None)
_model.fc = nn.Linear(_model.fc.in_features, sum(NUM_CLASSES))
_model.load_state_dict(_ck["state_dict"])
_model.eval()
print("Model ready.", flush=True)

# ── preprocessing ───────────────────────────────────────────────────────────
_transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.CenterCrop((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


# ── routes ──────────────────────────────────────────────────────────────────
@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "Missing image file — send as multipart/form-data with key 'image'"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        tensor = _transform(Image.open(file.stream).convert("RGB")).unsqueeze(0)
        with torch.no_grad():
            outputs = _model(tensor)

        results = {}
        idx = 0
        for i, task in enumerate(TASK_NAMES):
            probs = F.softmax(outputs[:, idx:idx + NUM_CLASSES[i]], dim=1)[0]
            pred  = torch.argmax(probs).item()
            results[task] = {
                "prediction": class_names[i][pred],
                "confidence": round(probs[pred].item() * 100, 1),
                "scores": {
                    class_names[i][j]: round(probs[j].item() * 100, 1)
                    for j in range(NUM_CLASSES[i])
                },
            }
            idx += NUM_CLASSES[i]

        return jsonify({"image": file.filename, "results": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6000, debug=False)
