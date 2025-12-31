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
    #convertir de nuemerico a etiqueta que saco mayor probabilidad
    pred=encoder.inverse_transform(pred)[0]


    # probabilidades
    proba_dict = None
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba([texto])[0]

        clases = encoder.inverse_transform(
            list(range(len(probs)))
        )

        proba_dict = {
            str(clases[i]): float(probs[i])
            for i in range(len(probs))
        }
    
    return pred, proba_dict

def predict_texts(textos):
    """
    textos: list[str]
    return:
      preds: list (clase o id)
      probas: list[list[float]] o None
      classes: list[str] (si predict_proba existe)
    """
    preds = model.predict(textos)

  # Predicción (ids o strings)
    pred_raw = model.predict(textos)

    # Convertir numpy a tipos Python
    pred_raw = [p.item() if hasattr(p, "item") else p for p in pred_raw]

    # Decodificar predicción a texto si viene como int (0,1,2) las etiquetas
    preds = []
    for p in pred_raw:
        if isinstance(p, int):
            preds.append(encoder.inverse_transform([p])[0])
        else:
            preds.append(str(p))

    # Probabilidades y nombres de clase
    probas = None
    class_names = None

    if hasattr(model, "predict_proba"):
        proba_np = model.predict_proba(textos)
        probas = proba_np.tolist()

        n_classes = proba_np.shape[1]
        class_names = encoder.inverse_transform(list(range(n_classes))).tolist()

    return preds, probas, class_names
