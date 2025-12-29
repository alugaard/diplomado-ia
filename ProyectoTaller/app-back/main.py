# -*- coding: utf-8 -*-
from flask import Flask, jsonify, request
from utils import predict_text

app = Flask(__name__)

# Endpoint parecido al tuyo, pero para texto (JSON)
@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "")

    if not isinstance(comentario, str) or comentario.strip() == "":
        return jsonify({"error": "Debes enviar 'comentario' como string no vacío"}), 400

    etiqueta= predict_text(comentario)

    
    resp = {
        "comentario": comentario,
        "prediccion": etiqueta
    }

    return jsonify(resp), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7002, debug=True)
