export default {
  version: '5.7.1',
  date: '2026-04-15',
  title_ru: 'Победы за красный цвет теперь засчитываются',
  title_en: 'Wins playing red are now counted',
  changes_ru: [
    { type: 'fix', text: 'Критическое: все победы игроков за красный цвет отвергались при сохранении в статистику. Исправлено — теперь учитываются корректно' },
    { type: 'fix', text: 'Убран дублирующийся серверный эндпоинт без защиты от флуда' },
    { type: 'perf', text: 'Старые клиенты продолжают работать — обратная совместимость сохранена' },
  ],
  changes_en: [
    { type: 'fix', text: 'Critical: every win playing the red side was rejected when saving stats. Fixed — they are now counted properly' },
    { type: 'fix', text: 'Removed a duplicate server endpoint that had no flood protection' },
    { type: 'perf', text: 'Old clients keep working — backward compatibility preserved' },
  ],
}
