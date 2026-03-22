"""
MCTS v4: smart root expansion + shallow inner tree.
Root получает все умные ходы. Внутри — 1 случайный ребёнок (shallow).
"""

import math
import random
from game import (GameState, Action, apply_action,
                  get_valid_transfers, sample_random_action,
                  sample_random_action_fast, _apply_transfer,
                  MAX_CHIPS, MAX_PLACE, FIRST_TURN_MAX, GOLDEN_STAND)


def _score_action(state, action):
    """Эвристическая оценка хода."""
    score = 1.0
    player = state.current_player

    if action.swap:
        return 1.5

    if action.transfer:
        src, dst = action.transfer
        grp_color, grp_size = state.top_group(src)
        new_total = len(state.stands[dst]) + grp_size
        if new_total >= MAX_CHIPS and grp_color == player:
            score += 5.0
            if dst == GOLDEN_STAND:
                score += 3.0
        elif grp_color == player:
            score += 0.5

    if action.placement:
        total_placed = sum(action.placement.values())
        score += total_placed * 0.3
        for idx, count in action.placement.items():
            top_color, _ = state.top_group(idx)
            if top_color == 1 - player:
                score += 0.4

    return score


def generate_root_actions(state, max_actions=12):
    """Генерирует умные ходы для root-узла."""
    if state.game_over:
        return []

    player = state.current_player
    opens = state.open_stands()

    # Первый ход — все 10 вариантов
    if state.is_first_turn():
        return [Action(placement={i: 1}) for i in opens if state.stand_space(i) > 0]

    actions = []

    # Swap
    if state.turn == 1 and state.swap_available:
        actions.append(Action(swap=True))

    # Переносы
    transfers = get_valid_transfers(state)
    closing = []
    normal = []
    for src, dst in transfers:
        grp_color, grp_size = state.top_group(src)
        if len(state.stands[dst]) + grp_size >= MAX_CHIPS and grp_color == player:
            closing.append((src, dst))
        else:
            normal.append((src, dst))

    # Все закрывающие
    for t in closing:
        actions.append(Action(transfer=t))
        # + с установкой
        avail = [i for i in opens if i != t[0] and i != t[1] and state.stand_space(i) > 1]
        if avail:
            idx = random.choice(avail)
            cap = min(state.stand_space(idx) - 1, MAX_PLACE)
            if cap > 0:
                actions.append(Action(transfer=t, placement={idx: min(3, cap)}))

    # Стратегические переносы (3-4 штуки)
    if normal:
        for t in random.sample(normal, min(3, len(normal))):
            actions.append(Action(transfer=t))

    # Только установка
    max_chips = MAX_PLACE
    can_close = state.can_close_by_placement()
    avail = []
    for idx in opens:
        sp = state.stand_space(idx)
        if sp <= 0:
            continue
        cap = sp if can_close else min(sp - 1, max_chips)
        if cap > 0:
            avail.append((idx, cap))

    if avail:
        # Поставить max на 1 стойку
        idx, cap = max(avail, key=lambda x: x[1])
        actions.append(Action(placement={idx: min(max_chips, cap)}))
        # На 2 стойки
        if len(avail) >= 2:
            i1, c1 = avail[0]
            i2, c2 = avail[1] if len(avail) > 1 else avail[0]
            if i1 != i2:
                actions.append(Action(placement={i1: min(2, c1), i2: min(1, c2)}))

    # Добить рандомными до max_actions
    seen = {hash(a) for a in actions}
    attempts = 0
    while len(actions) < max_actions and attempts < 20:
        a = sample_random_action(state)
        h = hash(a)
        if h not in seen:
            seen.add(h)
            actions.append(a)
        attempts += 1

    return actions[:max_actions]


class MCTSAgent:
    """
    Flat MCTS: root расширяется умными ходами,
    каждая симуляция = rollout от ребёнка root.
    Быстро и эффективно для большого branching factor.
    """

    def __init__(self, num_simulations=100, network=None, c_puct=2.0,
                 temperature=1.0, max_children=12):
        self.num_simulations = num_simulations
        self.network = network
        self.c_puct = c_puct
        self.temperature = temperature
        self.max_children = max_children

    def choose_action(self, state):
        actions = generate_root_actions(state, self.max_children)
        if not actions:
            return (Action(), {})
        if len(actions) == 1:
            return (actions[0], {actions[0]: 1.0})

        # Создаём детей root
        children = []
        for action in actions:
            child_state = apply_action(state, action)
            prior = _score_action(state, action)
            children.append({
                'action': action,
                'state': child_state,
                'visits': 0,
                'value_sum': 0.0,
                'prior': prior,
            })

        # Нормализуем prior
        total_prior = sum(c['prior'] for c in children)
        for c in children:
            c['prior'] /= total_prior

        # Симуляции
        for _ in range(self.num_simulations):
            # Select: UCB
            best_child = None
            best_score = -float('inf')
            total_visits = sum(c['visits'] for c in children) + 1

            for c in children:
                if c['visits'] == 0:
                    score = float('inf') * c['prior'] + random.random()
                else:
                    q = c['value_sum'] / c['visits']
                    explore = self.c_puct * c['prior'] * math.sqrt(total_visits) / (1 + c['visits'])
                    score = q + explore
                if score > best_score:
                    best_score = score
                    best_child = c

            # Evaluate: rollout или сеть
            if best_child['state'].game_over:
                value = self._terminal_value(best_child['state'], state.current_player)
            elif self.network:
                val = self.network.predict_value(best_child['state'])
                # val с точки зрения best_child.state.current_player
                # Нам нужно с точки зрения state.current_player (root)
                if best_child['state'].current_player != state.current_player:
                    val = -val
                value = val
            else:
                value = self._rollout(best_child['state'], state.current_player)

            best_child['visits'] += 1
            best_child['value_sum'] += value

        # Pick action
        return self._pick(children)

    def _rollout(self, state, perspective):
        """Rollout от состояния. Возвращает +1/-1/0 с точки зрения perspective."""
        s = state
        depth = 0
        while not s.game_over and depth < 100:
            a = sample_random_action_fast(s)
            s = apply_action(s, a)
            depth += 1
        if s.winner is None or s.winner == -1:
            return 0.0
        return 1.0 if s.winner == perspective else -1.0

    def _terminal_value(self, state, perspective):
        if state.winner is None or state.winner == -1:
            return 0.0
        return 1.0 if state.winner == perspective else -1.0

    def _pick(self, children):
        visits = [c['visits'] for c in children]
        total = sum(visits)

        if self.temperature < 0.01 or total == 0:
            best = max(children, key=lambda c: c['visits'])
            probs = {c['action']: (1.0 if c is best else 0.0) for c in children}
            return (best['action'], probs)

        if self.temperature == 1.0:
            weights = [v / total for v in visits]
        else:
            exp_visits = [v ** (1.0 / self.temperature) for v in visits]
            s = sum(exp_visits)
            weights = [v / s for v in exp_visits]

        probs = {c['action']: w for c, w in zip(children, weights)}
        chosen = random.choices(children, weights=weights, k=1)[0]
        return (chosen['action'], probs)


class RandomAgent:
    def choose_action(self, state):
        action = sample_random_action_fast(state)
        return (action, {})
