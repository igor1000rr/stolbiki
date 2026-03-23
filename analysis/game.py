"""
Игровая среда для настольной игры "Стойки".
Полная реализация правил с поддержкой self-play и MCTS.
"""

from dataclasses import dataclass, field
from typing import Optional

# ─── Константы ───────────────────────────────────────────────
NUM_STANDS = 10          # 9 обычных + 1 золотая
GOLDEN_STAND = 0         # Индекс золотой стойки
MAX_CHIPS = 11           # Макс фишек на стойке
MAX_PLACE = 3            # Макс фишек за установку
MAX_PLACE_STANDS = 2     # Макс стоек для установки
FIRST_TURN_MAX = 1       # Лимит фишек на первый ход


@dataclass
class Action:
    """
    Ход игрока.
    transfer: None или (src_idx, dst_idx) — перенос верхней группы
    placement: dict {stand_idx: count} — установка фишек
    swap: True если второй игрок решил поменять цвета
    """
    transfer: Optional[tuple] = None
    placement: dict = field(default_factory=dict)
    swap: bool = False

    def __hash__(self):
        t = self.transfer if self.transfer else ()
        p = tuple(sorted(self.placement.items()))
        return hash((t, p, self.swap))

    def __eq__(self, other):
        return (self.transfer == other.transfer and
                self.placement == other.placement and
                self.swap == other.swap)

    def __repr__(self):
        parts = []
        if self.swap:
            return "Action(SWAP)"
        if self.transfer:
            parts.append(f"перенос {self.transfer[0]}→{self.transfer[1]}")
        if self.placement:
            pl = ", ".join(f"стойка {k}: {v}" for k, v in self.placement.items())
            parts.append(f"установка [{pl}]")
        return f"Action({'; '.join(parts) if parts else 'пас'})"


class GameState:
    """Полное состояние игры."""

    def __init__(self, num_stands=NUM_STANDS):
        self.num_stands = num_stands
        self.stands = [[] for _ in range(num_stands)]
        self.closed = {}
        self.current_player = 0
        self.turn = 0
        self.swap_available = True
        self.game_over = False
        self.winner = None

    def copy(self):
        s = GameState.__new__(GameState)
        s.num_stands = self.num_stands
        s.stands = [chips[:] for chips in self.stands]
        s.closed = dict(self.closed)
        s.current_player = self.current_player
        s.turn = self.turn
        s.swap_available = self.swap_available
        s.game_over = self.game_over
        s.winner = self.winner
        return s

    def open_stands(self):
        return [i for i in range(self.num_stands) if i not in self.closed]

    def num_open(self):
        return self.num_stands - len(self.closed)

    def count_closed(self, player):
        return sum(1 for v in self.closed.values() if v == player)

    def stand_space(self, idx):
        if idx in self.closed:
            return 0
        return MAX_CHIPS - len(self.stands[idx])

    def top_group(self, idx):
        """Верхняя непрерывная группа одного цвета: (color, count)."""
        chips = self.stands[idx]
        if not chips:
            return (-1, 0)
        color = chips[-1]
        count = 0
        for i in range(len(chips) - 1, -1, -1):
            if chips[i] == color:
                count += 1
            else:
                break
        return (color, count)

    def is_first_turn(self):
        return self.turn == 0

    def can_close_by_placement(self):
        return self.num_open() <= 2


# ─── Генерация переносов ─────────────────────────────────────
def get_valid_transfers(state: GameState) -> list:
    transfers = []
    opens = state.open_stands()
    player = state.current_player

    for src in opens:
        grp_color, grp_size = state.top_group(src)
        if grp_size == 0:
            continue

        for dst in opens:
            if dst == src:
                continue
            dst_chips = state.stands[dst]
            dst_top_color, _ = state.top_group(dst)

            # Перенос на пустую или на тот же цвет
            if len(dst_chips) > 0 and dst_top_color != grp_color:
                continue

            new_total = len(dst_chips) + grp_size

            # Перенос разрешён даже при overflow — стойка закрывается
            transfers.append((src, dst))

    return transfers


# ─── Генерация установок ─────────────────────────────────────
def get_valid_placements(state: GameState) -> list:
    max_chips = FIRST_TURN_MAX if state.is_first_turn() else MAX_PLACE
    can_close = state.can_close_by_placement()

    available = []
    for idx in state.open_stands():
        space = state.stand_space(idx)
        if space <= 0:
            continue
        if not can_close:
            max_here = min(space - 1, max_chips)
            if max_here <= 0:
                continue
        else:
            max_here = min(space, max_chips)
        available.append((idx, max_here))

    placements = [{}]

    # Одна стойка
    for idx, cap in available:
        for count in range(1, min(cap, max_chips) + 1):
            placements.append({idx: count})

    # Две стойки
    if max_chips >= 2:
        for i in range(len(available)):
            for j in range(i + 1, len(available)):
                idx1, cap1 = available[i]
                idx2, cap2 = available[j]
                for c1 in range(1, min(cap1, max_chips - 1) + 1):
                    for c2 in range(1, min(cap2, max_chips - c1) + 1):
                        if c1 + c2 <= max_chips:
                            placements.append({idx1: c1, idx2: c2})

    return placements


# ─── Генерация всех ходов ─────────────────────────────────────
def get_legal_actions(state: GameState) -> list:
    if state.game_over:
        return []

    actions = []

    # Swap (только ход 1, для второго игрока)
    if state.turn == 1 and state.swap_available:
        actions.append(Action(swap=True))

    transfers = [None] + get_valid_transfers(state)

    for transfer in transfers:
        temp = state.copy()
        if transfer:
            _apply_transfer(temp, transfer[0], transfer[1])

        placements = get_valid_placements(temp)

        for placement in placements:
            if state.is_first_turn() and not placement and transfer is None:
                continue
            actions.append(Action(transfer=transfer, placement=placement))

    if not actions:
        actions = [Action()]

    return actions


# ─── Применение ходов ─────────────────────────────────────────
def _apply_transfer(state, src, dst):
    """Применяет перенос in-place. Возвращает True если стойка закрылась."""
    grp_color, grp_size = state.top_group(src)
    state.stands[src] = state.stands[src][:-grp_size]
    state.stands[dst].extend([grp_color] * grp_size)

    total = len(state.stands[dst])
    if total >= MAX_CHIPS:
        # Стойка закрывается цветом верхней группы, лишние снизу в сброс
        if total > MAX_CHIPS:
            state.stands[dst] = state.stands[dst][total - MAX_CHIPS:]
        state.closed[dst] = grp_color
        return True
    return False


def _apply_placement(state, placement):
    player = state.current_player
    can_close = state.can_close_by_placement()

    for idx, count in placement.items():
        state.stands[idx].extend([player] * count)
        total = len(state.stands[idx])
        if total >= MAX_CHIPS and can_close:
            if total > MAX_CHIPS:
                state.stands[idx] = state.stands[idx][total - MAX_CHIPS:]
            state.closed[idx] = player
        elif total > MAX_CHIPS:
            state.stands[idx] = state.stands[idx][total - MAX_CHIPS:]


def _apply_swap(state):
    for i in range(state.num_stands):
        state.stands[i] = [1 - c for c in state.stands[i]]
    state.closed = {k: 1 - v for k, v in state.closed.items()}


def apply_action(state: GameState, action: Action) -> GameState:
    """Применяет ход, возвращает НОВОЕ состояние."""
    ns = state.copy()

    if action.swap:
        _apply_swap(ns)
        ns.swap_available = False
        ns.current_player = 1 - ns.current_player
        ns.turn += 1
        _check_game_over(ns)
        return ns

    if action.transfer:
        _apply_transfer(ns, action.transfer[0], action.transfer[1])

    if action.placement:
        _apply_placement(ns, action.placement)

    if ns.turn >= 1:
        ns.swap_available = False

    ns.current_player = 1 - ns.current_player
    ns.turn += 1
    _check_game_over(ns)
    return ns


def _check_game_over(state):
    if len(state.closed) == state.num_stands:
        _determine_winner(state)
        return

    for p in [0, 1]:
        other = 1 - p
        if state.count_closed(p) > state.count_closed(other) + state.num_open():
            state.game_over = True
            state.winner = p
            return


def _determine_winner(state):
    state.game_over = True
    c0 = state.count_closed(0)
    c1 = state.count_closed(1)
    if c0 > c1:
        state.winner = 0
    elif c1 > c0:
        state.winner = 1
    else:
        if GOLDEN_STAND in state.closed:
            state.winner = state.closed[GOLDEN_STAND]
        else:
            state.winner = -1


# ─── Кодирование состояния для нейросети ──────────────────────
def encode_state(state: GameState) -> list:
    vec = []
    player = state.current_player
    opp = 1 - player

    for i in range(state.num_stands):
        chips = state.stands[i]
        c_me = chips.count(player) / MAX_CHIPS
        c_opp = chips.count(opp) / MAX_CHIPS
        top_color, top_size = state.top_group(i)

        if top_color == -1:
            tc = 0.5
        elif top_color == player:
            tc = 1.0
        else:
            tc = 0.0

        is_closed = 1.0 if i in state.closed else 0.0
        closed_by = 0.0
        if i in state.closed:
            closed_by = 1.0 if state.closed[i] == player else -1.0

        is_golden = 1.0 if i == GOLDEN_STAND else 0.0
        vec.extend([c_me, c_opp, tc, top_size / MAX_CHIPS, is_closed, closed_by, is_golden])

    vec.append(state.turn / 100.0)
    vec.append((state.count_closed(player) - state.count_closed(opp)) / state.num_stands)
    vec.append(state.num_open() / state.num_stands)

    return vec


STATE_SIZE = NUM_STANDS * 7 + 3


# ─── Быстрый сэмплер случайного хода ─────────────────────────
import random as _random

def sample_random_action(state: GameState) -> Action:
    """
    Генерирует ОДИН случайный допустимый ход без перебора всех.
    Гораздо быстрее чем get_legal_actions() + random.choice().
    """
    if state.game_over:
        return Action()

    # Swap: второй ход, с вероятностью 30%
    if state.turn == 1 and state.swap_available and _random.random() < 0.3:
        return Action(swap=True)

    player = state.current_player
    opens = state.open_stands()

    # Фаза 1: Перенос (или нет)
    transfer = None
    transfers = get_valid_transfers(state)
    if transfers and _random.random() < 0.4:
        transfer = _random.choice(transfers)

    # Применяем перенос на копию для проверки
    temp = state.copy()
    if transfer:
        _apply_transfer(temp, transfer[0], transfer[1])

    # Фаза 2: Установка
    max_chips = FIRST_TURN_MAX if state.is_first_turn() else MAX_PLACE
    can_close = temp.can_close_by_placement()

    # Доступные стойки
    available = []
    for idx in temp.open_stands():
        space = temp.stand_space(idx)
        if space <= 0:
            continue
        if not can_close:
            max_here = min(space - 1, max_chips)
        else:
            max_here = min(space, max_chips)
        if max_here > 0:
            available.append((idx, max_here))

    placement = {}
    if available:
        remaining = max_chips
        # Случайное число стоек (1 или 2)
        num_stands = min(_random.randint(1, MAX_PLACE_STANDS), len(available))
        chosen = _random.sample(available, num_stands)

        for idx, cap in chosen:
            if remaining <= 0:
                break
            count = _random.randint(1, min(cap, remaining))
            placement[idx] = count
            remaining -= count

    # На первый ход нужна хотя бы 1 фишка
    if state.is_first_turn() and not placement and transfer is None:
        if available:
            idx, cap = _random.choice(available)
            placement[idx] = 1

    return Action(transfer=transfer, placement=placement)


def sample_random_action_fast(state: GameState) -> Action:
    """
    Быстрый сэмплер для rollouts.
    Приоритет: закрытие стоек переносом, потом обычные ходы.
    """
    if state.game_over:
        return Action()

    if state.turn == 1 and state.swap_available and _random.random() < 0.3:
        return Action(swap=True)

    player = state.current_player
    opens = state.open_stands()

    # ── Фаза 1: Перенос ──
    transfer = None

    # Приоритет: ищем закрывающий перенос (своим цветом на стойку с 10+ фишками)
    closing_transfers = []
    normal_transfers = []

    if len(opens) >= 2:
        for src in opens:
            grp_color, grp_size = state.top_group(src)
            if grp_size == 0:
                continue
            for dst in opens:
                if dst == src:
                    continue
                dst_chips = state.stands[dst]
                dst_top, _ = state.top_group(dst)
                if len(dst_chips) > 0 and dst_top != grp_color:
                    continue
                new_total = len(dst_chips) + grp_size
                if new_total >= MAX_CHIPS:
                    closing_transfers.append((src, dst))
                    continue
                normal_transfers.append((src, dst))

    # 70% шанс закрыть если можно, иначе 40% шанс обычный перенос
    if closing_transfers and _random.random() < 0.7:
        transfer = _random.choice(closing_transfers)
    elif normal_transfers and _random.random() < 0.4:
        transfer = _random.choice(normal_transfers)

    # ── Фаза 2: Установка ──
    max_chips = FIRST_TURN_MAX if state.is_first_turn() else MAX_PLACE
    can_close = state.can_close_by_placement() or (
        transfer and transfer[1] in state.closed if transfer else False
    )

    # Пересчитываем opens после переноса (упрощённо: если закрыли — убираем)
    closed_by_transfer = set()
    if transfer:
        src, dst = transfer
        grp_color, grp_size = state.top_group(src)
        new_total = len(state.stands[dst]) + grp_size
        if new_total >= MAX_CHIPS:
            closed_by_transfer.add(dst)

    effective_open = [i for i in opens if i not in closed_by_transfer]
    # Пересчитываем can_close
    effective_num_open = len(effective_open) - len(closed_by_transfer)
    can_close_eff = (state.num_open() - len(closed_by_transfer)) <= 2

    available = []
    for idx in effective_open:
        space = state.stand_space(idx)
        if transfer and idx == transfer[1] and idx not in closed_by_transfer:
            # Цель переноса — пересчитываем место
            grp_color, grp_size = state.top_group(transfer[0])
            space = MAX_CHIPS - (len(state.stands[idx]) + grp_size)
        if transfer and idx == transfer[0]:
            # Источник — после снятия группы стало больше места
            grp_color, grp_size = state.top_group(transfer[0])
            space = MAX_CHIPS - (len(state.stands[idx]) - grp_size)

        if space <= 0:
            continue
        if not can_close_eff:
            max_here = min(space - 1, max_chips)
        else:
            max_here = min(space, max_chips)
        if max_here > 0:
            available.append((idx, max_here))

    placement = {}
    if available:
        remaining = max_chips
        num_stands = min(_random.randint(1, MAX_PLACE_STANDS), len(available))
        chosen = _random.sample(available, num_stands)
        for idx, cap in chosen:
            if remaining <= 0:
                break
            count = _random.randint(1, min(cap, remaining))
            placement[idx] = count
            remaining -= count

    if state.is_first_turn() and not placement and transfer is None:
        if available:
            idx, _ = _random.choice(available)
            placement[idx] = 1

    # Форсируем закрытие при ≤2 открытых стойках
    if can_close_eff and not placement and available:
        idx, cap = available[0]
        placement[idx] = cap

    return Action(transfer=transfer, placement=placement)


def print_state(state: GameState):
    print(f"\n{'='*60}")
    print(f"Ход #{state.turn}, Игрок {state.current_player + 1}")
    print(f"Счёт: P1={state.count_closed(0)}, P2={state.count_closed(1)}")
    print(f"Открытых: {state.num_open()}")
    print(f"{'─'*60}")
    for i in range(state.num_stands):
        prefix = "★" if i == GOLDEN_STAND else f"{i}"
        if i in state.closed:
            print(f"  [{prefix}] ЗАКРЫТА — P{state.closed[i]+1}")
        else:
            chips_str = "".join("●" if c == 0 else "○" for c in state.stands[i])
            print(f"  [{prefix}] {chips_str:14s} ({len(state.stands[i]):2d}/11)")
    print(f"{'='*60}")
