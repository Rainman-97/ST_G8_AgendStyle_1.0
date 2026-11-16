from math import exp
from typing import List, Tuple

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="AgendaStyle AI", version="0.1.0")


class RiskRequest(BaseModel):
    inasistencias_previas: float = Field(ge=0, le=1)
    antelacion_reserva: float = Field(ge=0, le=1)
    franja_horaria: float = Field(ge=0, le=1)
    cliente_nuevo: float = Field(ge=0, le=1)


# Arquitectura didáctica 4-5-1 definida en el documento de Fase 4.
# Los pesos son iniciales de demostración y deberán entrenarse con datos reales.
W1 = [
    [1.20, 0.40, -0.20, 0.30, 0.80],
    [0.30, -0.50, 0.60, 0.20, -0.20],
    [0.10, 0.30, 0.20, -0.40, 0.10],
    [0.80, 0.10, -0.10, 0.40, 0.50],
]
B1 = [0.10, 0.00, 0.05, 0.00, 0.10]
W2 = [0.90, -0.30, 0.25, 0.40, 0.70]
B2 = -0.70


def relu(value: float) -> float:
    return max(0.0, value)


def sigmoid(value: float) -> float:
    return 1 / (1 + exp(-value))


def predict(values: List[float]) -> Tuple[float, List[float]]:
    hidden = []
    for neuron in range(5):
        total = B1[neuron]
        for index, value in enumerate(values):
            total += value * W1[index][neuron]
        hidden.append(relu(total))

    output = B2 + sum(hidden[index] * W2[index] for index in range(5))
    return sigmoid(output), hidden


@app.get("/health")
def health():
    return {"ok": True, "service": "AgendaStyle AI", "model": "4-5-1"}


@app.post("/predict")
def prediction(request: RiskRequest):
    values = [
        request.inasistencias_previas,
        request.antelacion_reserva,
        request.franja_horaria,
        request.cliente_nuevo,
    ]
    probability, hidden = predict(values)
    level = "Bajo" if probability < 0.30 else "Medio" if probability < 0.60 else "Alto"
    action = {
        "Bajo": "Recordatorio estándar 24 horas antes",
        "Medio": "Recordatorio con solicitud de confirmación",
        "Alto": "Dos recordatorios y confirmación explícita",
    }[level]
    return {
        "ok": True,
        "probabilidad": round(probability, 4),
        "nivel": level,
        "accion": action,
        "modelo": "4-5-1-demo",
        "activacionOculta": [round(value, 4) for value in hidden],
    }
