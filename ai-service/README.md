# AgendaStyle AI

Servicio prototipo de predicción de inasistencia con una red neuronal 4-5-1.

## Ejecución local

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/VPS
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Endpoints:

- `GET /health`: comprueba que el servicio esté disponible.
- `POST /predict`: recibe las cuatro características normalizadas y devuelve probabilidad, nivel y acción de recordatorio.

El modelo usa pesos ilustrativos para demostrar el flujo de Fase 4. Debe entrenarse con citas reales antes de utilizarlo como una métrica productiva.
