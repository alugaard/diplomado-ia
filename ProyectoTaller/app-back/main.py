# -*- coding: utf-8 -*-
from flask import Flask, jsonify, request
from utils import predict_text,predict_texts
import base64
import io
import pandas as pd

##OPENAI
import requests
from openai import OpenAI
from pydantic import BaseModel
import json

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
            item["probabilidad"] = {class_names[j]: float(probas[i][j]) for j in range(len(class_names))}
        resultados.append(item)
    
    return jsonify(resultados), 200

@app.route("/predict_openai", methods=["POST"])
def openAiUso():
    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "")

    if not isinstance(comentario, str) or comentario.strip() == "":
        return jsonify({"error": "Debes enviar 'comentario' como string no vacío"}), 400
    API_KEY = "sk-xePE_4Bi13W2LnR--EG83Q"
    url = "https://models.villena.cl/v1/responses"

    prompt="Eres un experto en clasificación de textos en redes sociales. Tu tarea es leer un tweet en español y asignarlo a una y solo una de las siguientes categorías: odio, incivilidad o normal. Odio: cualquier expresión que promueva o incite a la discriminación, la hostilidad o la violencia hacia una persona o grupo en una relación asimétrica de poder, por razones como raza, etnia, género, orientación sexual, religión, nacionalidad, discapacidad u otra característica similar. Incivilidad: cualquier comportamiento o actitud que rompa las normas de respeto, cortesía o consideración entre personas, incluyendo insultos, ataques personales, sarcasmo, desprecio u otras formas de agresión verbal que no constituyen discurso de odio. Normal: expresiones que no contienen hostilidad, ataques, incivilidad ni discurso de odio. Debes responder solo con una de estas tres palabras: odio, incivilidad, normal. No entregues explicaciones ni texto adicional. Ejemplos de estos serian. La persona que me atendio tiene un problemas de actitud. Clasificación: incivilidad. La forma en que actuo estuvo bien. Los migrantes son una plaga que debería ser expulsada. Clasificación: odio . Eres un imbécil, no sabes nada. Clasificación: incivilidad. Hoy cociné por primera vez pastel de choclo y quedó buenísimo. Clasificación: normal. ¿Alguien sabe si mañana llueve en Santiago?. Clasificación: normal. Gracias a todos por el apoyo estos días, se valora mucho. Clasificación:normal. Este es el twets: "
    prompt=prompt+comentario
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    data = {
        "model": "openai/gpt-5-nano",
        "input": prompt,
    }

    response = requests.post(url, headers=headers, json=data)
    data = response.json()
    print("respuesta de openAI: ")
    print(data)
    return jsonify(data["output"][1]["content"][0]["text"]), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7002, debug=True)
