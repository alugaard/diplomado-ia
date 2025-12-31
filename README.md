Here you can open ProcesamientoLenguajeNatural/tarea2.ipynb directly in Colab

DEV:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/alugaard/diplomado-ia/blob/dev/ProcesamientoLenguajeNatural/tarea2.ipynb)

MAIN:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/alugaard/diplomado-ia/blob/main/ProcesamientoLenguajeNatural/tarea2.ipynb)

## Instalación de Conda en MacOS

```bash
brew install --cask miniconda
conda init zsh
source ~/.zshrc
```

## Instalación de dependencias

```bash
sh dependencias.sh
```

## Ejecutar back por el momento, falta una capa

```bash
conda activate nps_api
python main.py
```

## Convertir csv a base64 para probar back en postman
En app-back/TransformaCsvABase64/
Ejecutar python converter.py , el cual convertira nuestro archivo escuestas.csv a un base64.
