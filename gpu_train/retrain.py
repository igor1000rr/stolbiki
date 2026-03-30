"""
Доучивание GPU-нейросети на данных реальных игроков.

Скачивает партии с сервера → кодирует позиции → добавляет в буфер →
дообучает сеть → экспортирует новые веса.

Запуск:
  cd gpu_train
  py -3.12 retrain.py --url https://snatch-highrise.com --token ADMIN_JWT_TOKEN

Или с локальной БД:
  py -3.12 retrain.py --db ../data/stolbiki.db
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
import numpy as np
import json
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'analysis'))

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# ═══ Сеть (копия gpu_trainer.py) ═══

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


# ═══ Кодирование (копия gpu_trainer.py) ═══

def encode_state_from_raw(state_data, player):
    """Кодирует состояние из формата collector.js → 107 фич"""
    stands = state_data.get('stands', [[] for _ in range(10)])
    closed = state_data.get('closed', {})
    turn = state_data.get('turn', 0)
    
    # Расширяем до 10 стоек если меньше
    while len(stands) < 10:
        stands.append([])
    
    opp = 1 - player
    f = []
    for i in range(10):
        chips = stands[i] if i < len(stands) else []
        total = len(chips)
        my = sum(1 for c in chips if c == player)
        op = sum(1 for c in chips if c == opp)
        
        # top_group
        tc, ts = -1, 0
        if chips:
            tc = chips[-1]
            ts = 1
            for j in range(len(chips) - 2, -1, -1):
                if chips[j] == tc: ts += 1
                else: break
        
        is_closed = 1.0 if str(i) in closed or i in closed else 0.0
        closed_by_me = 0.0
        ci = closed.get(str(i), closed.get(i))
        if ci is not None:
            closed_by_me = 1.0 if ci == player else 0.0
        
        f.extend([
            total / 11.0,
            my / 11.0,
            op / 11.0,
            ts / 11.0,
            1.0 if tc == player else 0.0,
            1.0 if tc == opp else 0.0,
            is_closed,
            closed_by_me,
            1.0 if i == 0 else 0.0,
            max(0, 11 - total) / 11.0,
        ])
    
    # Глобальные
    mc = sum(1 for k, v in (closed.items() if isinstance(closed, dict) else []) if (v if isinstance(v, int) else int(v)) == player)
    oc = sum(1 for k, v in (closed.items() if isinstance(closed, dict) else []) if (v if isinstance(v, int) else int(v)) == opp)
    num_open = 10 - len(closed)
    
    # swapAvailable и canCloseByPlacement сложно восстановить из сырых данных — приближение
    swap_available = 1.0 if turn <= 1 else 0.0
    can_close = 1.0 if num_open <= 2 else 0.0
    
    f.extend([mc/5, oc/5, (mc-oc)/5, num_open/10, turn/100, swap_available, can_close])
    
    return np.array(f, dtype=np.float32)


def games_to_samples(games):
    """Конвертирует партии из сервера → обучающие сэмплы (state_vec, value)"""
    samples = []
    for game in games:
        winner = game.get('winner')
        if winner is None or winner < 0:
            continue
        for move in game.get('moves', []):
            state = move.get('state', {})
            player = move.get('player', state.get('player', 0))
            try:
                vec = encode_state_from_raw(state, player)
                value = 1.0 if player == winner else -1.0
                samples.append((vec, value))
            except:
                continue
    return samples


# ═══ Скачивание данных ═══

def download_games(url, token, limit=5000):
    """Скачивает партии через API"""
    import urllib.request
    req = urllib.request.Request(
        f'{url}/api/admin/training/export-gpu?limit={limit}',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data.get('games', [])


def load_games_from_db(db_path):
    """Загружает партии напрямую из SQLite"""
    import sqlite3
    conn = sqlite3.connect(db_path)
    rows = conn.execute('SELECT game_data, winner FROM training_data WHERE total_moves >= 5 ORDER BY created_at DESC LIMIT 10000').fetchall()
    conn.close()
    
    games = []
    for game_data_str, winner in rows:
        try:
            data = json.loads(game_data_str)
            if winner is not None and winner >= 0:
                games.append({'moves': data.get('moves', []), 'winner': winner})
        except:
            continue
    return games


# ═══ Доучивание ═══

def retrain(model_path, games, output_path, epochs=30, lr=0.0005, batch_size=512):
    """Доучивает модель на данных реальных игроков"""
    
    # Загружаем модель
    net = StoykaNet().to(DEVICE)
    ckpt = torch.load(model_path, map_location=DEVICE, weights_only=False)
    net.load_state_dict(ckpt['model'])
    version = ckpt.get('version', 0)
    history = ckpt.get('history', [])
    
    print(f'Загружена модель v{version}')
    print(f'Партий от игроков: {len(games)}')
    
    # Конвертируем
    samples = games_to_samples(games)
    print(f'Обучающих сэмплов: {len(samples)}')
    
    if len(samples) < 100:
        print('Слишком мало данных для доучивания')
        return None
    
    # Подготовка данных
    X = np.array([s[0] for s in samples], dtype=np.float32)
    Y = np.array([s[1] for s in samples], dtype=np.float32)
    
    X_tensor = torch.tensor(X).to(DEVICE)
    Y_tensor = torch.tensor(Y).unsqueeze(1).to(DEVICE)
    
    # Обучение
    opt = optim.Adam(net.parameters(), lr=lr)
    net.train()
    
    print(f'\nДообучение: {epochs} эпох, batch={batch_size}, lr={lr}')
    
    for epoch in range(epochs):
        indices = torch.randperm(len(X_tensor))
        total_loss = 0
        batches = 0
        
        for i in range(0, len(indices), batch_size):
            idx = indices[i:i+batch_size]
            x_batch = X_tensor[idx]
            y_batch = Y_tensor[idx]
            
            pred = net(x_batch)
            loss = F.mse_loss(pred, y_batch)
            
            opt.zero_grad()
            loss.backward()
            opt.step()
            
            total_loss += loss.item()
            batches += 1
        
        avg_loss = total_loss / batches
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f'  Эпоха {epoch+1}/{epochs} | loss={avg_loss:.4f}')
    
    # Сохраняем
    new_version = version + 1
    history.append({
        'version': new_version,
        'loss': avg_loss,
        'human_games': len(games),
        'human_samples': len(samples),
        'time': time.time(),
        'type': 'human_retrain',
    })
    
    torch.save({
        'model': net.state_dict(),
        'optimizer': opt.state_dict(),
        'version': new_version,
        'history': history,
    }, output_path)
    
    print(f'\n✅ Модель v{new_version} сохранена: {output_path}')
    return net


def export_weights_json(model_path, json_path):
    """Экспортирует веса модели в JSON для браузера"""
    ckpt = torch.load(model_path, map_location='cpu', weights_only=False)
    weights = {}
    total = 0
    for k, v in ckpt['model'].items():
        arr = np.round(v.numpy().astype(np.float32), 4).flatten()
        weights[k] = arr.tolist()
        total += arr.size
    
    with open(json_path, 'w') as f:
        json.dump(weights, f, separators=(',', ':'))
    
    size = os.path.getsize(json_path)
    print(f'Экспорт: {total:,} параметров → {json_path} ({size/1024:.0f}KB)')


# ═══ CLI ═══

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Доучивание GPU-нейросети на данных игроков')
    parser.add_argument('--url', default='https://snatch-highrise.com', help='URL сервера')
    parser.add_argument('--token', help='JWT токен админа')
    parser.add_argument('--db', help='Путь к SQLite БД (альтернатива API)')
    parser.add_argument('--model', default='gpu_checkpoint/model_v500.pt', help='Путь к модели')
    parser.add_argument('--output', default='gpu_checkpoint/model_retrained.pt', help='Куда сохранить')
    parser.add_argument('--epochs', type=int, default=30)
    parser.add_argument('--lr', type=float, default=0.0005)
    parser.add_argument('--export-json', default='../src/engine/gpu_weights.json', help='Экспорт весов в JSON')
    args = parser.parse_args()
    
    print(f'Устройство: {DEVICE}')
    if DEVICE.type == 'cuda':
        print(f'GPU: {torch.cuda.get_device_name(0)}')
    
    # Скачиваем данные
    if args.db:
        print(f'Загрузка из БД: {args.db}')
        games = load_games_from_db(args.db)
    elif args.token:
        print(f'Загрузка с {args.url}...')
        games = download_games(args.url, args.token)
    else:
        print('Укажите --token или --db')
        sys.exit(1)
    
    print(f'Загружено {len(games)} партий')
    
    if not games:
        print('Нет данных для обучения')
        sys.exit(0)
    
    # Доучиваем
    net = retrain(args.model, games, args.output, args.epochs, args.lr)
    
    if net and args.export_json:
        export_weights_json(args.output, args.export_json)
        print(f'\n🎯 Обновите gpu_weights.json в репозитории:')
        print(f'   cd .. && git add src/engine/gpu_weights.json')
        print(f'   git commit -m "update: GPU-нейросеть дообучена на {{len(games)}} партиях игроков"')
        print(f'   git push')
