"""
Восстановление PyTorch модели из gpu_weights.json (браузерные веса).
Поддерживает v6 (56 ключей, value only) и v7 (60 ключей, policy+value).

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
ACTION_FEAT_SIZE = 35

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
        self.policy_ctx = nn.Sequential(nn.Linear(hidden, 64), nn.ReLU())
        self.action_enc = nn.Linear(ACTION_FEAT_SIZE, 64)
    def backbone(self, x):
        h = self.proj(x)
        for b in self.blocks: h = b(h)
        return h
    def forward(self, x):
        h = self.backbone(x)
        return self.value(h), h


if __name__ == '__main__':
    json_path = sys.argv[1] if len(sys.argv) > 1 else '../src/engine/gpu_weights.json'
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'gpu_checkpoint_v7/model_recovered.pt'

    print(f'Загрузка весов из {json_path}...')
    with open(json_path) as f:
        w = json.load(f)

    has_policy = 'policy_ctx.0.weight' in w
    version_str = 'v7 (policy+value)' if has_policy else 'v6 (value only)'
    print(f'  Формат: {version_str}')

    net = StoykaNet()
    sd = net.state_dict()

    total = 0
    for key in sd:
        if key in w:
            shape = sd[key].shape
            flat = torch.tensor(w[key], dtype=torch.float32)
            sd[key] = flat.reshape(shape)
            total += flat.numel()
        else:
            print(f'  ⚠ Ключ {key} не найден — инициализирован рандомно')

    net.load_state_dict(sd)
    print(f'  {total:,} параметров загружены')

    x = torch.zeros(1, INPUT_SIZE)
    with torch.no_grad():
        v, _ = net(x)
    print(f'  Test forward: value={v.item():.4f}')

    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    torch.save({
        'model': net.state_dict(),
        'version': 1793,
        'history': [{'note': f'recovered from {json_path} ({version_str})'}],
    }, out_path)
    print(f'  ✅ Сохранено: {out_path}')
