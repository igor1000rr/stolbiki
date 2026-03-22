"""
Нейросеть на чистом numpy для AlphaZero-style обучения.
Value head: оценка позиции [-1, 1].
"""

import numpy as np
import json
from game import GameState, encode_state, STATE_SIZE


def relu(x):
    return np.maximum(0, x)

def relu_grad(x):
    return (x > 0).astype(float)

def tanh(x):
    return np.tanh(x)

def tanh_grad(x):
    t = np.tanh(x)
    return 1 - t ** 2


class NumpyNet:
    """Простая MLP на numpy с обучением."""

    def __init__(self, state_size=STATE_SIZE, hidden=64):
        self.state_size = state_size
        # Xavier инициализация
        s1 = np.sqrt(2.0 / state_size)
        s2 = np.sqrt(2.0 / hidden)

        self.w1 = np.random.randn(state_size, hidden) * s1
        self.b1 = np.zeros(hidden)
        self.w2 = np.random.randn(hidden, hidden) * s2
        self.b2 = np.zeros(hidden)
        self.w3 = np.random.randn(hidden, 1) * s2
        self.b3 = np.zeros(1)

    def forward(self, x):
        """x: (batch, state_size) → value: (batch, 1)"""
        self.z1 = x @ self.w1 + self.b1
        self.a1 = relu(self.z1)
        self.z2 = self.a1 @ self.w2 + self.b2
        self.a2 = relu(self.z2)
        self.z3 = self.a2 @ self.w3 + self.b3
        self.out = tanh(self.z3)
        self.x_input = x
        return self.out

    def backward(self, target, lr=0.001):
        """Обратное распространение. target: (batch, 1)."""
        batch = target.shape[0]

        # dL/dout = 2 * (out - target) / batch  (MSE gradient)
        d_out = 2 * (self.out - target) / batch

        # Через tanh
        d_z3 = d_out * tanh_grad(self.z3)
        d_w3 = self.a2.T @ d_z3
        d_b3 = d_z3.sum(axis=0)

        d_a2 = d_z3 @ self.w3.T
        d_z2 = d_a2 * relu_grad(self.z2)
        d_w2 = self.a1.T @ d_z2
        d_b2 = d_z2.sum(axis=0)

        d_a1 = d_z2 @ self.w2.T
        d_z1 = d_a1 * relu_grad(self.z1)
        d_w1 = self.x_input.T @ d_z1
        d_b1 = d_z1.sum(axis=0)

        # Gradient clipping
        max_norm = 1.0
        for g in [d_w1, d_w2, d_w3]:
            norm = np.linalg.norm(g)
            if norm > max_norm:
                g *= max_norm / norm

        # Обновление
        self.w1 -= lr * d_w1
        self.b1 -= lr * d_b1
        self.w2 -= lr * d_w2
        self.b2 -= lr * d_b2
        self.w3 -= lr * d_w3
        self.b3 -= lr * d_b3

        loss = np.mean((self.out - target) ** 2)
        return loss

    def predict_value(self, state: GameState) -> float:
        vec = np.array(encode_state(state)).reshape(1, -1)
        return float(self.forward(vec)[0, 0])

    def train_batch(self, states, values, lr=0.001):
        x = np.array(states)
        y = np.array(values).reshape(-1, 1)
        self.forward(x)
        loss = self.backward(y, lr)
        return loss

    def copy_weights(self):
        return {
            'w1': self.w1.copy(), 'b1': self.b1.copy(),
            'w2': self.w2.copy(), 'b2': self.b2.copy(),
            'w3': self.w3.copy(), 'b3': self.b3.copy(),
        }

    def load_weights(self, weights):
        self.w1 = weights['w1'].copy()
        self.b1 = weights['b1'].copy()
        self.w2 = weights['w2'].copy()
        self.b2 = weights['b2'].copy()
        self.w3 = weights['w3'].copy()
        self.b3 = weights['b3'].copy()

    def save(self, path):
        np.savez(path, w1=self.w1, b1=self.b1, w2=self.w2, b2=self.b2,
                 w3=self.w3, b3=self.b3)

    def load(self, path):
        data = np.load(path)
        self.w1 = data['w1']
        self.b1 = data['b1']
        self.w2 = data['w2']
        self.b2 = data['b2']
        self.w3 = data['w3']
        self.b3 = data['b3']
