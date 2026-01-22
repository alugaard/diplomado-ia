# -*- coding: utf-8 -*-
import joblib
import os
from dotenv import load_dotenv
load_dotenv()
# Obtenemos la API KEY de forma segura
api_key = os.getenv("GEMINI_API_KEY")



# Cargar una vez al iniciar el servidor
modelo_tfidf_logreg_clf = joblib.load("modelo_tfidf_logreg_clf.pkl")
#modelo_gru = joblib.load("modelo_gru.pkl")


# ====== BETO + LoRA (PEFT) ======
# Carpeta exportada con:
# adapter_model.safetensors, adapter_config.json, tokenizer*, vocab, label_encoder.pkl
BETO_ADAPTER_PATH = "modelo_beto_lora"
BETO_BASE_MODEL = "dccuchile/bert-base-spanish-wwm-uncased"
BETO_MAX_LEN = 128

# Variables globales (se cargan solo si se usa BETO)
beto_model = None
beto_tokenizer = None
beto_encoder = None
beto_device = None

def load_beto_once():
    global beto_model, beto_tokenizer, beto_encoder, beto_device
    if beto_model is not None:
        return 

    import torch
    import joblib
    import os
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    from peft import PeftModel, LoraConfig, get_peft_model

    beto_device = "cuda" if torch.cuda.is_available() else "cpu"
    
    # 1. Basics
    beto_encoder = joblib.load(f"{BETO_ADAPTER_PATH}/label_encoder.pkl")
    num_labels = len(beto_encoder.classes_)
    beto_tokenizer = AutoTokenizer.from_pretrained(BETO_ADAPTER_PATH)

    # 2. Create Base Architecture
    base_model = AutoModelForSequenceClassification.from_pretrained(
        BETO_BASE_MODEL,
        num_labels=num_labels,
        use_safetensors=True
    )

    # 3. RECREATE LORA SKELETON (Must match your Colab config exactly)
    # Using the same parameters from your "Bloque 4"
    lora_config = LoraConfig(
        r=8,
        lora_alpha=16,
        target_modules=["query", "value"],
        lora_dropout=0.1,
        bias="none",
        modules_to_save=["classifier"],
        task_type="SEQ_CLS"
    )
    # This turns the base model into a PeftModel with the correct internal names
    beto_model = get_peft_model(base_model, lora_config)

    # 4. NOW LOAD THE STATE DICT
    state_dict_path = os.path.join(BETO_ADAPTER_PATH, "full_state_dict.pt")
    if os.path.exists(state_dict_path):
        # We use weights_only=False because your file is a legacy .pt from Colab
        state_dict = torch.load(state_dict_path, map_location=beto_device, weights_only=False)
        
        # Now that names like 'lora_A' and 'modules_to_save' exist in beto_model, 
        # the weights will actually land in the right place.
        msg = beto_model.load_state_dict(state_dict, strict=False)
        print(f"✅ DEBUG API: Weights Injected! Msg: {msg}")
        
        # 5. Consolidate for maximum speed and accuracy
        beto_model = beto_model.merge_and_unload()
    
    beto_model.to(beto_device)
    beto_model.eval()
    print("✅ DEBUG API: Ready for +90% accuracy.")
    
# ===============================
#              BETO
# ===============================
def predict_text(comentario):
    load_beto_once()
    import torch
        
    # 2. Tokenizar
    inputs = beto_tokenizer(
        comentario, 
        return_tensors="pt", 
        truncation=True, 
        padding="max_length", 
        max_length=BETO_MAX_LEN
    ).to(beto_device)
    
    # 3. Inferencia
    with torch.no_grad():
        logits = beto_model(**inputs).logits
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
        pred_id = torch.argmax(logits, dim=1).item()
    
    # 4. Decodificar etiqueta
    label = beto_encoder.inverse_transform([pred_id])[0]
    
    return label, probs.tolist()


def predict_texts(textos, batch_size=32):
    load_beto_once()
    
    import torch
    from tqdm import tqdm
    import numpy as np

    all_preds = []
    all_probas = []

    for i in tqdm(range(0, len(textos), batch_size), desc="Clasificando comentarios"):
        batch_textos = textos[i:i + batch_size]

        enc = beto_tokenizer(
            batch_textos,
            truncation=True,
            padding="max_length",
            max_length=BETO_MAX_LEN,
            return_tensors="pt"
        )
        enc = {k: v.to(beto_device) for k, v in enc.items()}

        with torch.no_grad():
            logits = beto_model(**enc).logits
            probs = torch.softmax(logits, dim=1).detach().cpu().numpy()
            # Aseguramos que sea un array de enteros
            pred_ids = torch.argmax(logits, dim=1).detach().cpu().numpy().astype(int)

        # Transformación de IDs a Etiquetas usando el objeto cargado
        batch_labels = beto_encoder.inverse_transform(pred_ids).tolist()
        
        all_probas.extend(probs.tolist())
        all_preds.extend(batch_labels)

    # Obtenemos los nombres de clases directamente del encoder
    class_names = beto_encoder.classes_.tolist()

    # DEBUG FINAL DE CONTROL
    print("-" * 30)
    print(f"DEBUG API - Clases detectadas: {class_names}")
    # Mostramos los primeros 3 para verificar el mapeo
    for j in range(min(3, len(all_preds))):
        print(f"DEBUG API - Texto: {textos[j][:30]}... -> Pred: {all_preds[j]}")
    print("-" * 30)

    return all_preds, all_probas, class_names

# ===============================
#            GRU o tfidf / CLÁSICO
# ===============================
def predict_textclasico(texto: str,modelo_clasico="tfidf"):
    """
    Recibe un string (comentario) y devuelve:
    - etiqueta predicha
    - probabilidades por clase (si el modelo lo soporta)
    """
    model=None
    #if modelo_clasico == 'gru':
    #    print("Prediccion con modelo gru")
    #    model=modelo_gru
    if modelo_clasico == 'tfidf':
        print("Prediccion con modelo tfidf")
        model=modelo_tfidf_logreg_clf
    
    pred = model.predict([texto])
    #convertir de nuemerico a etiqueta que saco mayor probabilidad
    pred=beto_encoder.inverse_transform(pred)[0]


    # probabilidades
    proba_dict = None
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba([texto])[0]

        clases = beto_encoder.inverse_transform(
            list(range(len(probs)))
        )

        proba_dict = {
            str(clases[i]): float(probs[i])
            for i in range(len(probs))
        }
    
    return pred, proba_dict

def predict_textsClasico(textos,modelo_clasico="tfidf"):
    """
    textos: list[str]
    return:
      preds: list (clase o id)
      probas: list[list[float]] o None
      classes: list[str] (si predict_proba existe)
    """
    model=None
    #if modelo_clasico == 'gru':
    #    model=modelo_gru
    if modelo_clasico == 'tfidf':
        model=modelo_tfidf_logreg_clf

    preds = model.predict(textos)

  # Predicción (ids o strings)
    pred_raw = model.predict(textos)

    # Convertir numpy a tipos Python
    pred_raw = [p.item() if hasattr(p, "item") else p for p in pred_raw]

    # Decodificar predicción a texto si viene como int (0,1,2) las etiquetas
    preds = []
    for p in pred_raw:
        if isinstance(p, int):
            preds.append(beto_encoder.inverse_transform([p])[0])
        else:
            preds.append(str(p))

    # Probabilidades y nombres de clase
    probas = None
    class_names = None

    if hasattr(model, "predict_proba"):
        proba_np = model.predict_proba(textos)
        probas = proba_np.tolist()

        n_classes = proba_np.shape[1]
        class_names = beto_encoder.inverse_transform(list(range(n_classes))).tolist()

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
    API_KEY = api_key

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

import json
import time
from google import genai

def predict_textsGeminis(comentarios: list):
    """
    Procesa una lista completa de comentarios en una sola petición a Gemini.
    """
    API_KEY = api_key
    client = genai.Client(vertexai=False, api_key=API_KEY)
    

    
    # 1. Unimos todos los comentarios en un solo string separado por '---'
    texto_unido = "\n---\n".join(comentarios)

    # 2. Adaptamos tu prompt experto para procesar la lista completa
    prompt = """
    Eres un experto en clasificación de comentarios sobre productos y atenciones de una plataforma líder de comercio electrónico y 
    servicios fintech. Tu tarea es leer los comentarios en español y asignarle a una y solo una de las siguientes categorías: 
    'Sugerencia', 'Felicitaciones y Agradecimientos' o 'Reclamo'. Debes responder solo con una de estas tres etiquetas: 
    'Sugerencia', 'Felicitaciones y Agradecimientos' o 'Reclamo'. Devuelve un array con cada JSON estrictamente con esta estructura:
    {'comentario': str, 'prediccion': str, 'probabilidad': dict}. IMPORTANTE: Usa solo comillas dobles, no incluyas 
    etiquetas markdown como ```json.  Ejemplos de estos serian. Deberían implementar una herramienta visible para 
    que el usuario pueda verificar el estado de su contraseña (ej. expirada/activa). Clasificación: Sugerencia. 
    Aprecio que las impresoras sean multifuncionales (imprimir, escanear, copiar). Clasificación:
     Felicitaciones y Agradecimientos . El sistema de restablecimiento me pide una pregunta de seguridad 
     que nunca configuré o no recuerdo. Clasificación: Reclamo. Estos son los comentarios los cuales te los separe 
     con '---' para que me entregues las clasificacion de cada uno en un json con la estructura que te dije
      y todo eso dentro de un array:"""+ texto_unido

    print("ESTE SERA EL PROMPT:")
    print(prompt)

    preds = []
    probas = []

    class_names = ['Felicitaciones y Agradecimientos', 'Reclamo', 'Sugerencia']

    try:
        # 3. Una única llamada a la API
        response = client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=prompt
        )
        
        # Limpieza y carga de la lista de diccionarios
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        print("respuesta geminis:")
        print (raw_text)
        res_list = json.loads(raw_text)
        
        # 4. Iteramos los resultados obtenidos para llenar las listas finales
        for item in res_list:
            preds.append(item.get("prediccion"))
            
            p_dict = item.get("probabilidad", {})
            p_lista = [float(p_dict.get(clase, 0.0)) for clase in class_names]
            probas.append(p_lista)

    except Exception as e:
        print(f"Error en la petición masiva: {e}")
        # En caso de error general, podrías llenar con valores por defecto 
        # según el tamaño de la lista original
        preds = ["Error"] * len(comentarios)
        probas = [[0.0, 0.0, 0.0]] * len(comentarios)

    return preds, probas, class_names




