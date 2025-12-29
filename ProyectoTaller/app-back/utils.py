# -*- coding: utf-8 -*-
import joblib


MODEL_PATH = "modelo.pkl"
modelo = "clasico"

# Codificación de etiquetas
encoder = joblib.load('label_encoder.pkl')


# Cargar una vez al iniciar el servidor
model = joblib.load(MODEL_PATH)
if modelo == "clasico":
    joblib.load(MODEL_PATH)
elif modelo == "beto":
    load_pretrained(MODEL_PATH)

def predict_text(texto: str,tipo_modelo="clasico"):
    """
    Recibe un string (comentario) y devuelve:
    - etiqueta predicha
    - probabilidades por clase (si el modelo lo soporta)
    """
    pred = model.predict([texto])
    pred=encoder.inverse_transform(pred)[0]

    print("aqui va el valor:")
    print(pred)

    #proba = None
    #if hasattr(model, "predict_proba"):
    #    proba = model.predict_proba([texto])[0].tolist()

    return pred#, proba
