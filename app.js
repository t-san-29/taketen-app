'use strict';

/**
 * app.js  –  尺メートル法 変換ツール メインスクリプト
 * =====================================================
 * このファイルが担う役割:
 *   1. 変換データの定義（単位名・換算係数）
 *   2. 数値フォーマット関数（表示桁数の調整）
 *   3. UI の初期化（セレクトボックス生成・イベント登録）
 *   4. 変換計算と結果カードの描画
 *   5. 換算早見表（全単位の組み合わせ表）の生成
 *   6. タブ切り替え処理
 *
 * 処理の流れ:
 *   ページ読み込み
 *     → initCategory() × 3（長さ・面積・体積）
 *         → セレクトボックスにoptionを追加
 *         → doConvert() を即時呼び出し（初期表示）
 *         → input / change イベントに doConvert() を登録
 *         → buildTable() で換算早見表を生成
 *     → タブボタンにクリックイベントを登録
 */


// =============================================================
// 1. 変換データ定義
// =============================================================
/**
 * CATEGORIES オブジェクト
 * -----------------------
 * カテゴリ（length / area / volume）ごとに単位の一覧と換算係数を定義する。
 *
 * 設計方針:
 *   すべての換算は「SI基本単位（m / m² / L）を中間値として経由する」方式。
 *   つまり factor は「その単位 → SI基本単位」への係数。
 *
 *   例: 1尺 → m への変換
 *       1尺 × factor(尺) = 10/33 m
 *
 *   2単位間の変換は convert() 関数が行う（後述）。
 *
 * 換算係数の根拠:
 *   長さ … 計量法に基づく定義値: 1尺 = 10/33 m（≒ 303.03mm）
 *   面積 … 1坪 = 1間² = (60/33)² m² = 3600/1089 m² = 400/121 m²
 *           1畳 = 0.5坪 = 200/121 m²
 *   体積 … 1升 = 1.8039 L（計量法に基づく定義値）
 *
 * type フィールドの意味:
 *   'shaku'  … 尺貫法の単位（青系の背景色で表示）
 *   'metric' … メートル法の単位（オレンジ系の背景色で表示）
 */
const CATEGORIES = {

  // --- 長さ ---
  length: {
    label: '長さ',
    baseLabel: 'm',   // SI基本単位の表示名（現在は参照のみ）
    units: [
      // 尺貫法（小さい順に並べている）
      { id: 'rin',   label: '厘',  type: 'shaku', factor: 1 / 3300 },  // 1厘 = 1/10分 = 1/100寸
      { id: 'bu',    label: '分',  type: 'shaku', factor: 1 / 330  },  // 1分 = 1/10寸
      { id: 'sun',   label: '寸',  type: 'shaku', factor: 1 / 33   },  // 1寸 = 1/10尺
      { id: 'shaku', label: '尺',  type: 'shaku', factor: 10 / 33  },  // 1尺 = 10/33 m（定義値）
      { id: 'ken',   label: '間',  type: 'shaku', factor: 60 / 33  },  // 1間 = 6尺
      { id: 'jo',    label: '丈',  type: 'shaku', factor: 100 / 33 },  // 1丈 = 10尺
      // メートル法
      { id: 'mm',    label: 'mm',  type: 'metric', factor: 0.001  },
      { id: 'cm',    label: 'cm',  type: 'metric', factor: 0.01   },
      { id: 'm',     label: 'm',   type: 'metric', factor: 1      },
    ],
  },

  // --- 面積 ---
  area: {
    label: '面積',
    baseLabel: 'm²',
    units: [
      // 尺貫法
      { id: 'jo',    label: '畳',  type: 'shaku', factor: 200 / 121 }, // 1畳 = 0.5坪
      { id: 'tsubo', label: '坪',  type: 'shaku', factor: 400 / 121 }, // 1坪 = 1間² = 400/121 m²
      // メートル法
      { id: 'm2',    label: 'm²',  type: 'metric', factor: 1    },
    ],
  },

  // --- 体積・容積 ---
  volume: {
    label: '体積・容積',
    baseLabel: 'L',
    units: [
      // 尺貫法（小さい順に並べている）
      { id: 'go',   label: '合',  type: 'shaku', factor: 0.18039  }, // 1合 = 1/10升
      { id: 'sho',  label: '升',  type: 'shaku', factor: 1.8039   }, // 1升 = 1.8039 L（定義値）
      { id: 'to',   label: '斗',  type: 'shaku', factor: 18.039   }, // 1斗 = 10升
      { id: 'koku', label: '石',  type: 'shaku', factor: 180.39   }, // 1石 = 10斗 = 100升
      // メートル法
      { id: 'ml',   label: 'mL', type: 'metric', factor: 0.001  },
      { id: 'l',    label: 'L',  type: 'metric', factor: 1      },
      { id: 'm3',   label: 'm³', type: 'metric', factor: 1000   }, // 1m³ = 1000 L
    ],
  },
};


// =============================================================
// 2. 数値フォーマット関数
// =============================================================
/**
 * fmt(n) - 数値を人間が読みやすい文字列に変換する
 * -------------------------------------------------
 * 有効数字4桁を基準としつつ、値の大きさに応じて小数点以下の桁数を変える。
 * 日本語ロケール（ja-JP）を使うため、千の位にカンマが入る。
 *
 * @param {number} n - フォーマットしたい数値
 * @returns {string} 表示用の文字列
 *
 * 例:
 *   fmt(1818.18) → "1,818"
 *   fmt(30.303)  → "30.30"
 *   fmt(3.0303)  → "3.030"
 *   fmt(0.30303) → "0.30303"
 *   fmt(0.003)   → "0.003"
 */
function fmt(n) {
  if (n === 0) return '0';
  const abs = Math.abs(n);

  if (abs >= 10000) {
    // 1万以上: 小数なし、千区切りあり（例: 18,182）
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 0 });
  }
  if (abs >= 1000) {
    // 千〜万未満: 小数1桁（例: 1,818.2）
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 1 });
  }
  if (abs >= 100) {
    // 百〜千未満: 小数2桁（例: 303.03）
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  }
  if (abs >= 10) {
    // 十〜百未満: 小数3桁（例: 30.303）
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 3 });
  }
  if (abs >= 1) {
    // 1〜十未満: 小数4桁（例: 3.0303）
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 4 });
  }
  if (abs >= 0.01) {
    // 0.01以上1未満: 小数5桁で計算し末尾の0を除去（例: 0.30303）
    return n.toFixed(5).replace(/\.?0+$/, '');
  }
  // 非常に小さい値: 有効数字4桁の指数表記（例: 9.091e-5）
  return n.toPrecision(4);
}


// =============================================================
// 3. 変換計算関数
// =============================================================
/**
 * convert(value, fromFactor, toFactor) - 単位変換の中核
 * --------------------------------------------------------
 * 「SI基本単位を中間値として経由する」2ステップ変換を行う。
 *
 * ステップ1: value × fromFactor → SI基本単位の値
 * ステップ2: ÷ toFactor         → 変換先単位の値
 *
 * @param {number} value      - 変換元の数値
 * @param {number} fromFactor - 変換元単位のSI係数（CATEGORIES内のfactor）
 * @param {number} toFactor   - 変換先単位のSI係数（CATEGORIES内のfactor）
 * @returns {number} 変換後の数値
 *
 * 例: 1尺 → cm
 *   convert(1, 10/33, 0.01) = 1 × (10/33) / 0.01 = 30.303...
 */
function convert(value, fromFactor, toFactor) {
  return value * fromFactor / toFactor;
}


// =============================================================
// 4. UIの初期化
// =============================================================
/**
 * initCategory(catId) - カテゴリごとのUI初期化
 * ---------------------------------------------
 * 以下を一括して行う:
 *   - セレクトボックスにoptionを動的生成（尺貫法 / メートル法 のoptgroup付き）
 *   - デフォルト選択単位を設定
 *   - 入力欄・セレクトのイベントリスナー登録
 *   - 初期状態で一度 doConvert() を実行（空欄メッセージを表示）
 *   - buildTable() で換算早見表を生成
 *
 * @param {string} catId - カテゴリID（'length' / 'area' / 'volume'）
 */
function initCategory(catId) {
  const cat       = CATEGORIES[catId];
  const inputEl   = document.getElementById(`${catId}-input`);
  const fromEl    = document.getElementById(`${catId}-from`);
  const resultsEl = document.getElementById(`${catId}-results`);

  // --- セレクトボックスを構築 ---
  // 尺貫法とメートル法を optgroup で視覚的に分けて表示する
  const shakuGroup  = document.createElement('optgroup');
  shakuGroup.label  = '尺貫法';
  const metricGroup = document.createElement('optgroup');
  metricGroup.label = 'メートル法';

  cat.units.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.label;
    // type が 'shaku' なら尺貫法グループへ、それ以外はメートル法グループへ
    (u.type === 'shaku' ? shakuGroup : metricGroup).appendChild(opt);
  });

  fromEl.appendChild(shakuGroup);
  fromEl.appendChild(metricGroup);

  // --- デフォルト選択単位を設定 ---
  // それぞれ「現場でいちばんよく使う単位」をデフォルトにしている
  const defaultUnit = catId === 'length' ? 'shaku'   // 尺
                    : catId === 'area'   ? 'tsubo'   // 坪
                    : 'sho';                          // 升
  fromEl.value = defaultUnit;

  // --- 変換処理（クロージャ） ---
  /**
   * doConvert() - 現在の入力値と選択単位をもとに全単位へ変換し、結果を描画する
   * 入力欄の値が空 or 非数値の場合は「入力してください」メッセージを表示。
   */
  function doConvert() {
    const raw = parseFloat(inputEl.value);

    // 未入力・非数値の場合は空状態メッセージを表示して終了
    if (isNaN(raw) || inputEl.value === '') {
      resultsEl.innerHTML = '<p class="empty-state">数値を入力すると各単位に変換します</p>';
      return;
    }

    const fromId   = fromEl.value;
    const fromUnit = cat.units.find(u => u.id === fromId);

    // DocumentFragment を使って一括DOM操作（描画コスト削減）
    const frag = document.createDocumentFragment();

    // 全単位ぶんの結果カードを生成
    cat.units.forEach(u => {
      const result = convert(raw, fromUnit.factor, u.factor);

      // カード要素を作成
      const div = document.createElement('div');
      div.className = `result-item ${u.type}`;  // shaku or metric でスタイルが変わる

      // 現在の変換元単位は枠線を強調表示
      if (u.id === fromId) div.classList.add('active-unit');

      // 単位ラベル（小文字・灰色）
      const label = document.createElement('div');
      label.className = 'result-label';
      label.textContent = u.label;

      // 変換後の数値（大きく・太字）
      const val = document.createElement('div');
      val.className = 'result-value';
      val.textContent = fmt(result);

      div.appendChild(label);
      div.appendChild(val);
      frag.appendChild(div);
    });

    // 凡例（尺貫法 / メートル法の色分け説明）
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML =
      '<span><span class="legend-dot" style="background:#eef4fb;border:1px solid #b8d0e8"></span>尺貫法</span>' +
      '<span><span class="legend-dot" style="background:#faf4ee;border:1px solid #e0c9b0"></span>メートル法</span>';

    // 既存の結果を削除して新しい内容に置き換える
    resultsEl.innerHTML = '';
    resultsEl.appendChild(frag);
    resultsEl.appendChild(legend);
  }

  // --- イベントリスナー登録 ---
  inputEl.addEventListener('input', doConvert);   // 文字を入力するたびに即時変換
  fromEl.addEventListener('change', doConvert);   // 単位を変更したときも再変換

  // 初期描画（ページ読み込み直後に空欄メッセージを表示）
  doConvert();

  // 換算早見表を生成
  buildTable(catId);
}


// =============================================================
// 5. 換算早見表の生成
// =============================================================
/**
 * buildTable(catId) - 換算早見表のDOMを構築する
 * -----------------------------------------------
 * 「1 [各単位] = [全単位への換算値]」を行列形式で表示するテーブルを生成する。
 *
 * テーブル構造:
 *   thead: 1行目 … 列ヘッダー（単位名）
 *   tbody: 各行 … 「1 [単位]」を基準にした全単位の換算値
 *
 * ヘッダーの色分け:
 *   尺貫法の列 → class="shaku-header"  （ネイビー）
 *   メートル法  → class="metric-header" （オレンジ）
 *
 * 対角線セル（自分→自分）は太字で表示（値は必ず1になる）。
 *
 * @param {string} catId - カテゴリID（'length' / 'area' / 'volume'）
 */
function buildTable(catId) {
  const cat   = CATEGORIES[catId];
  const table = document.getElementById(`${catId}-table`);
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  // --- ヘッダー行を生成 ---
  const headerRow = document.createElement('tr');

  // 左上の空セル（行ラベル列のヘッダー）
  const thEmpty = document.createElement('th');
  thEmpty.textContent = '1 [単位]';
  headerRow.appendChild(thEmpty);

  // 各単位を列ヘッダーとして追加
  cat.units.forEach(u => {
    const th = document.createElement('th');
    th.textContent = u.label;
    // 尺貫法 / メートル法で色を変える
    th.className = u.type === 'shaku' ? 'shaku-header' : 'metric-header';
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);

  // --- データ行を生成（各単位を「1」とした換算行） ---
  cat.units.forEach(fromUnit => {
    const tr = document.createElement('tr');

    // 行の先頭セル: 「1 尺」「1 間」のような行ラベル
    const tdLabel = document.createElement('td');
    tdLabel.textContent = `1 ${fromUnit.label}`;
    tr.appendChild(tdLabel);

    // 全単位への換算値をセルとして追加
    cat.units.forEach(toUnit => {
      const td  = document.createElement('td');
      const val = convert(1, fromUnit.factor, toUnit.factor);
      td.textContent = fmt(val);

      // 対角線（fromUnit === toUnit）は必ず "1" になる。視覚的に強調
      if (fromUnit.id === toUnit.id) td.style.fontWeight = '700';

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}


// =============================================================
// 6. タブ切り替え処理
// =============================================================
/**
 * タブボタンのクリックイベント
 * ----------------------------
 * クリックされたタブを active にし、対応するセクションだけを表示する。
 *
 * 仕組み:
 *   - .tab ボタンの data-tab 属性 = 対応する <section> の id
 *   - active クラスの付け外しで CSS が表示・非表示を制御する
 *   - aria-selected も更新してアクセシビリティに対応
 */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;  // クリックされたタブが対応するセクションID

    // 全タブの active を外し、クリックされたタブだけ active にする
    document.querySelectorAll('.tab').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });

    // 全セクションを非表示にし、対象セクションだけ表示する
    document.querySelectorAll('.tab-content').forEach(sec => {
      sec.classList.toggle('active', sec.id === target);
    });
  });
});


// =============================================================
// 7. 起動
// =============================================================
// 3カテゴリ分の初期化を実行する。
// これにより、セレクトボックス生成・イベント登録・換算表生成がすべて行われる。
initCategory('length');
initCategory('area');
initCategory('volume');
