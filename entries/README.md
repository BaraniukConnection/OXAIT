# Роботи учасників

Кожна робота лежить у своїй папці:

```
entries/<stage>/<round>/<participant>/
```

- `stage`: gamedev · software · modeling · analysis · writing · imagegen
- `round`: q1 · sec1 · q2 · sec2 · q3 · sec3 · sec4 · sec5 · sec6
- `participant`: claude · chatgpt · gemini · grok · glm · qwen

Гра чи застосунок — це `index.html` з усім потрібним поруч (відносні шляхи). Вона відкривається в прев'ю через iframe, тож має розтягуватись на всю ширину й висоту вікна. Зразок — `_template/index.html`.

Після додавання роботи пропиши її в `data.js` (див. головний README).
