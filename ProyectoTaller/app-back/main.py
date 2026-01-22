# -*- coding: utf-8 -*-
import base64
import io
import json
import re
import unicodedata

import pandas as pd

##OPENAI
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import BaseModel
#import nltk
#from nltk.corpus import stopwords

from utils import predict_text, predict_texts,predict_textGeminis,predict_textclasico,predict_textsGeminis,predict_textsClasico

app = Flask(__name__)
CORS(app)


# Pruebas unitarias
@app.route("/predict", methods=["POST"])
def predict():
    modelo_elegido = request.args.get('model', 'beto')
    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "")
    print("modelo_elegido: "+modelo_elegido)
    resp={}
    if modelo_elegido != "gemini":

        if not isinstance(comentario, str) or comentario.strip() == "":
            return jsonify({"error": "Debes enviar 'comentario' como string no vacío"}), 400
        pred= None
        proba= None
        if modelo_elegido == 'beto':
            pred, proba = predict_text(normalize_text(comentario))
        else : #modelo_elegido gru o tfidf
            pred, proba = predict_textclasico(normalize_text(comentario))

        resp = {"comentario": comentario, "prediccion": str(pred), "probabilidad": proba}
    else:
        resp= predict_geminis(comentario)

    return jsonify(resp), 200


# Pruebas con archivo en base64(csv). saca de la primera columna del csv los comentarios a evaluar
@app.route("/predict_csv", methods=["POST"])
def predict_csv():
    #nltk.download('stopwords')
    modelo_elegido = request.args.get('model', 'beto')
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
        df = pd.read_csv(io.StringIO(text), sep=None, engine="python")
    except Exception as e:
        return jsonify({"error": "No se pudo leer el CSV: {}".format(str(e))}), 400

    if df.shape[1] == 0:
        return jsonify({"error": "CSV sin columnas"}), 400

    # Obtengo los comentarios de la primera columna
    comentarios = df.iloc[:, 0].astype(str).tolist()
    comentarios_normalizados = []
    for comentario in comentarios:
        comentarios_normalizados.append(normalize_text(comentario))

    #spanish_stop_words = stopwords.words('spanish')
    #sentiment_protectors = ['no', 'sin', 'pero', 'mucho', 'muy']
    #for word in sentiment_protectors:
    #    if word in spanish_stop_words:
    #        spanish_stop_words.remove(word)
    #company_noise = ['sistema', 'sistemas', 'equipo', 'equipos', 'software', 'herramientas', 'trabajar', 'archivo', 'excel', 'intranet']

    
    #normalized_stop_words = [normalize_text(word) for word in spanish_stop_words]
    #normalized_stop_words.extend(company_noise)

    #def remove_stop_words(text: str) -> str:
    #    words = text.split()
    #    filtered = [w for w in words if w not in normalized_stop_words]
    #    return " ".join(filtered)
    
    #comentarios_normalizados_sin_stopwords = []
    #for comentario in comentarios_normalizados:
    #    comentarios_normalizados_sin_stopwords.append(remove_stop_words(comentario))

    # Predicción
    if modelo_elegido != "gemini":
        if modelo_elegido == 'beto':
            preds, probas, class_names = predict_texts(comentarios_normalizados)
        if modelo_elegido == 'tfidf':
            preds, probas, class_names = predict_textsClasico(comentarios_normalizados)
    else :
        preds, probas, class_names = predict_textsGeminis(comentarios)

    resultados = []
    for i, texto in enumerate(comentarios):
        item = {"comentario": texto, "prediccion": preds[i]}
        if probas is not None:
            item["probabilidad"] = {
                class_names[j]: float(probas[i][j]) for j in range(len(class_names))
            }
        resultados.append(item)

    return jsonify(resultados), 200

def predict_geminis(comentario):
    com, pred, proba = predict_textGeminis(comentario)

    # 2. Construimos el diccionario con el formato
    resp = {
        "comentario": com,
        "prediccion": str(pred),
        "probabilidad": proba
    }
    return resp

def normalize_text(text: str) -> str:
    text = text.lower()
    text = unicodedata.normalize("NFD", text)
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    text = re.sub(r"[^a-z0-9ñ ]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7002, debug=True)
