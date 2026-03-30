"""
Восстановление PyTorch модели из gpu_weights.json (браузерные веса).
Используй когда нет .pt файла, но есть gpu_weights.json.

  cd gpu_train
  py -3.12 recover_model.py
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import json
import os
import sys

INPUT_SIZE = 107

class ResBlock(nn.Module):
    def __init__(self, d):
        super().__init__()
        self.fc1, self.ln1 = nn.Linear(d, d), nn.LayerNorm(d)
        self.fc2, self.ln2 = nn.Linear(d, d), nn.LayerNorm(d)
    def forward(self, x):
        return F.relu(self.ln2(self.fc2(F.relu(self.ln1(self.fc1(x))))) + x)

class StoykaNet(nn.Module):
    def __init__(self, hidden=256, blocks=6):
        super().__init__()
        self.proj = nn.Sequential(nn.Linear(INPUT_SIZE, hidden), nn.LayerNorm(hidden), nn.ReLU())
        self.blocks = nn.ModuleList([ResBlock(hidden) for _ in range(blocks)])
        self.value = nn.Sequential(nn.Linear(hidden, 64), nn.ReLU(), nn.Linear(64, 1), nn.Tanh())
    def forward(self, x):
        h = self.proj(x)
        for b in self.blocks: h = b(h)
        return self.value(h)


if __name__ == '__main__':
    json_path = sys.argv[1] if len(sys.argv) > 1 else '../src/engine/gpu_weights.json'
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'gpu_checkpoint/model_recovered.pt'

    print(f'Загрузка весов из {json_path}...')
    with open(json_path) as f:
        w = json.load(f)

    net = StoykaNet()
    sd = net.state_dict()

    total = 0
    for key in sd:
        if key not in w:
            print(f'  ❌ Ключ {key} не найден в JSON!')
            sys.exit(1)
        shape = sd[key].shape
        flat = torch.tensor(w[key], dtype=torch.float32)
        sd[key] = flat.reshape(shape)
        total += flat.numel()

    net.load_state_dict(sd)
    print(f'  {total:,} параметров загружены')

    # Верификация
    x = torch.zeros(1, INPUT_SIZE)
    with torch.no_grad():
        y = net(x).item()
    print(f'  Test forward: {y:.4f}')

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    torch.save({
        'model': net.state_dict(),
        'version': 623,
        'history': [{'note': 'recovered from gpu_weights.json'}],
    }, out_path)
    print(f'  ✅ Сохранено: {out_path}')
