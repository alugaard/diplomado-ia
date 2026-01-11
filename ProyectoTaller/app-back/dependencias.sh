
##Para instalacion previa en mac
#brew install --cask miniconda
#conda init zsh
#source ~/.zshrc




# ============================================================
# CREAR ENTORNO PARA API DE CLASIFICACIÓN NPS (modelo_clasico)
# ============================================================
conda update --all

# Crear entorno con Python estable
conda create -n nps_api python=3.11

##Solo para versiones antiguas de mac
conda init zsh
source ~/.zshrc

# Activar el entorno
conda activate nps_api


# ============================================================
# INSTALAR DEPENDENCIAS PRINCIPALES
# ============================================================

# Flask → servidor web / API REST
# joblib → cargar modelo .pkl
# scikit-learn → TF-IDF + Logistic Regression
# numpy, scipy → operaciones numéricas usadas internamente
conda install flask joblib scikit-learn numpy scipy pandas requests openai flask-cors -y
conda install pytorch torchvision torchaudio -c pytorch -y
pip install transformers peft accelerate
pip install --upgrade google-genai


# ============================================================
# (OPCIONAL) Verificación rápida
# ============================================================

python - <<'EOF'
import flask, joblib, sklearn, numpy, scipy, pandas, requests, openai
print("Flask:", flask.__version__)
print("joblib:", joblib.__version__)
print("scikit-learn:", sklearn.__version__)
print("numpy:", numpy.__version__)
print("scipy:", scipy.__version__)
print("pandas:", pandas.__version__)
print("requests:", requests.__version__)
print("requests:", openai.__version__)
print("✅ Entorno listo para ejecutar la API")
EOF
