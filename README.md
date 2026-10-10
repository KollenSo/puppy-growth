# 小狗養成 · 儲蓄成長記

用儲蓄進度驅動嘅小狗養成頁（粵語 UI）。成長階段**只跟**養成已計入金額；餵食／玩耍／摸摸只係玩樂互動（localStorage）。

## GitHub Pages

本目錄係完整靜態站（相對路徑）。推上 repo 後啟用 Pages（source: root / `docs` / `gh-pages` 視 repo 設定）。已含 `.nojekyll`。

公開 URL 例：`https://<user>.github.io/<repo>/`

## 開啟

```bash
cd /workspace/puppy-growth
cp /workspace/ib/savings_snapshot.json data/savings_snapshot.json
python3 -m http.server 8765 --bind 127.0.0.1
```

打開：http://127.0.0.1:8765/

## 養成計分規則

- 目標 **$48,000**
- **IB 現有結餘（約 $2,241）唔計入**小狗成長；遊戲進度由 **$0／0%** 開始
- 下個月開始存錢之後，先會把新增儲蓄計入養成進度
- 頁面仍顯示 IB 快照作參考，並標明「暫唔計入養成」
- 前端**唔會**直連 IBKR，只讀 `data/savings_snapshot.json`

## 更新數據

```bash
python3 /workspace/ib/export_savings_snapshot.py
cp /workspace/ib/savings_snapshot.json /workspace/puppy-growth/data/savings_snapshot.json
```

## 成長階段（progressPct）

| 進度 | 階段 | 圖檔 |
|------|------|------|
| 0–10% | 新生小狗 | `assets/stages/stage-0.jpg` |
| 10–25% | 小小狗 | `assets/stages/stage-1.jpg` |
| 25–50% | 成長中 | `assets/stages/stage-2.jpg` |
| 50–75% | 青少年 | `assets/stages/stage-3.jpg` |
| 75–100% | 成犬 | `assets/stages/stage-4.jpg` |

## 美術來源／授權

- **階段插畫**：`assets/stages/stage-0.jpg` … `stage-4.jpg` — 為本專案生成嘅一致風格小狗插畫（自用／本 app 刊載）。UI 只用 JPG。
- UI 字體：Google Fonts **Noto Sans TC**（SIL Open Font License）。

## 檔案

- `index.html` / `styles.css` / `app.js` — 單頁 app
- `assets/stages/` — 五階段狗圖
- `data/savings_snapshot.json` — 儲蓄快照副本
