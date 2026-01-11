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

# ====== BETO + LoRA (PEFT) ======
# Carpeta exportada con:
# adapter_model.safetensors, adapter_config.json, tokenizer*, vocab, label_encoder.pkl
BETO_ADAPTER_PATH = "modelo_beto_lora"
BETO_BASE_MODEL = "dccuchile/bert-base-spanish-wwm-uncased"
BETO_MAX_LEN = 64

# Variables globales (se cargan solo si se usa BETO)
beto_model = None
beto_tokenizer = None
beto_encoder = None
beto_device = None


def load_beto_once():
    """Carga BETO base + adapter LoRA + tokenizer + encoder una sola vez."""
    global beto_model, beto_tokenizer, beto_encoder, beto_device

    if beto_model is not None:
        return  # ya cargado

    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    from peft import PeftModel

    beto_device = "cuda" if torch.cuda.is_available() else "cpu"

    # tokenizer guardado en la carpeta del adapter
    beto_tokenizer = AutoTokenizer.from_pretrained(BETO_ADAPTER_PATH)

    # cargar base model (de HuggingFace cache) + pegar adapter LoRA
    base_model = AutoModelForSequenceClassification.from_pretrained(
        BETO_BASE_MODEL,
        num_labels=3,
    use_safetensors=True
    ).to(beto_device)

    beto_model = PeftModel.from_pretrained(base_model, BETO_ADAPTER_PATH).to(beto_device)
    beto_model.eval()

    # encoder guardado junto al modelo BETO (recomendado)
    beto_encoder = joblib.load(f"{BETO_ADAPTER_PATH}/label_encoder.pkl")


# ===============================
#              BETO
# ===============================
def predict_text(texto: str, tipo_modelo="beto"):
    """
    Igual estilo que predict_textGru:
    - predicción (etiqueta texto)
    - probabilidades por clase (dict)
    """
    load_beto_once()

    import torch

    enc = beto_tokenizer(
        texto,
        truncation=True,
        padding="max_length",
        max_length=BETO_MAX_LEN,
        return_tensors="pt"
    )
    enc = {k: v.to(beto_device) for k, v in enc.items()}

    with torch.no_grad():
        outputs = beto_model(**enc)
        logits = outputs.logits  # [1, num_classes]

        pred_id = torch.argmax(logits, dim=1).item()
        pred = beto_encoder.inverse_transform([pred_id])[0]

        # probas
        probs = torch.softmax(logits, dim=1).squeeze(0).detach().cpu().numpy()

    clases = beto_encoder.inverse_transform(list(range(len(probs))))

    proba_dict = {
        str(clases[i]): float(probs[i])
        for i in range(len(probs))
    }

    return pred, proba_dict


def predict_texts(textos):
    """
    Igual estilo que predict_textsGru:
    return:
      preds: list[str]
      probas: list[list[float]]
      class_names: list[str]
    """
    load_beto_once()

    import torch

    # Tokenizar en batch
    enc = beto_tokenizer(
        textos,
        truncation=True,
        padding="max_length",
        max_length=BETO_MAX_LEN,
        return_tensors="pt"
    )
    enc = {k: v.to(beto_device) for k, v in enc.items()}

    with torch.no_grad():
        logits = beto_model(**enc).logits  # [B, C]
        probs = torch.softmax(logits, dim=1).detach().cpu().numpy()

        pred_ids = torch.argmax(logits, dim=1).detach().cpu().numpy().tolist()

    # convertir ids -> etiquetas
    preds = beto_encoder.inverse_transform(pred_ids).tolist()

    # nombres de clases (en orden de columnas)
    class_names = beto_encoder.inverse_transform(list(range(probs.shape[1]))).tolist()

    return preds, probs.tolist(), class_names

# ===============================
#            GRU / CLÁSICO
# ===============================
def predict_textGru(texto: str,tipo_modelo="clasico"):
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

def predict_textsGru(textos):
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


    # ===============================
#            GEMINIS 
# ===============================
from google import genai
import json
def predict_textGeminis(texto: str):
    """
    Recibe un string (comentario) y devuelve:
    - etiqueta predicha
    - probabilidades por clase (si el modelo lo soporta)
    """
    API_KEY = "AIzaSyBrDpKhwHHu_QTIT02H8qU68sDRR7gRLIU"

    client = genai.Client(vertexai=False, api_key=API_KEY)
    prompt = """Eres un experto en clasificación de comentarios sobre productos y atenciones de una plataforma líder de comercio electrónico y servicios fintech. Tu tarea es leer los comentarios en español y asignarle a una y solo una de las siguientes categorías: 'Sugerencia', 'Felicitaciones y Agradecimientos' o 'Reclamo'. Debes responder solo con una de estas tres etiquetas: 'Sugerencia', 'Felicitaciones y Agradecimientos' o 'Reclamo'. Devuelve un JSON estrictamente con esta estructura:{'comentario': str, 'prediccion': str, 'probabilidad': dict}. IMPORTANTE: Usa solo comillas dobles, no incluyas etiquetas markdown como ```json.  Ejemplos de estos serian. Deberían implementar una herramienta visible para que el usuario pueda verificar el estado de su contraseña (ej. expirada/activa). Clasificación: Sugerencia. Aprecio que las impresoras sean multifuncionales (imprimir, escanear, copiar). Clasificación: Felicitaciones y Agradecimientos . El sistema de restablecimiento me pide una pregunta de seguridad que nunca configuré o no recuerdo. Clasificación: Reclamo. Este es el comentario: """
    prompt = prompt + texto

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    #print("Repsuesta geminis: "+ response.text)
    # Convertimos el string de Gemini a un diccionario real de Python
    res_dict = json.loads(response.text)
    
    # Extraemos los valores
    comentario = res_dict.get("comentario")
    pred = res_dict.get("prediccion")
    proba = res_dict.get("probabilidad")
    
    return comentario, pred, proba




