# -*- coding: utf-8 -*-
from flask import Flask, jsonify, request
from utils import predict_text,predict_texts
import base64
import io
import pandas as pd

app = Flask(__name__)

# Pruebas unitarias
@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "")

    if not isinstance(comentario, str) or comentario.strip() == "":
        return jsonify({"error": "Debes enviar 'comentario' como string no vacío"}), 400

    pred, proba = predict_text(comentario)

    resp = {"comentario": comentario, "prediccion": str(pred), "probabilidad":proba}

    

    return jsonify(resp), 200

# Pruebas con archivo en base64(csv). saca de la primera columna del csv los comentarios a evaluar
@app.route("/predict_csv", methods=["POST"])
def predict_csv():
    data = request.get_json(silent=True) or {}

    b64 = data.get("archivo", "")
    if not isinstance(b64, str) or not b64.strip():
        return jsonify({"error": "Debes enviar 'archivo' en base64"}), 400

    # Quitar encabezado tipo data:text/csv;base64,... (si es que viene)
    if "," in b64 and b64.startswith("data:"):
        b64 = b64.split(",", 1)[1]

    # Decodificar
    try:
        csv_bytes = base64.b64decode(b64)
    except Exception:
        return jsonify({"error": "Base64 inválido"}), 400

    # Leer CSV
    try:
        text = csv_bytes.decode("utf-8", errors="ignore")
        df = pd.read_csv(io.StringIO(text), sep=None, engine='python')
    except Exception as e:
        return jsonify({"error": f"No se pudo leer el CSV: {str(e)}"}), 400

    if df.shape[1] == 0:
        return jsonify({"error": "CSV sin columnas"}), 400

    #Obtengo los comentarios de la primera columna
    comentarios = df.iloc[:, 0].astype(str).tolist()

    # Predicción
    preds, probas, class_names = predict_texts(comentarios)

    resultados = []
    for i, texto in enumerate(comentarios):
        item = {"comentario": texto, "prediccion": preds[i]}
        if probas is not None:
            item["probabilidades"] = {class_names[j]: float(probas[i][j]) for j in range(len(class_names))}
        resultados.append(item)
    
    return jsonify(resultados), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7002, debug=True)
