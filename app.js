'use strict';

// ===== 変換データ定義 =====
// factor: SI基本単位への換算係数（長さ→m、面積→m²、体積→L）

const CATEGORIES = {
  length: {
    label: '長さ',
    baseLabel: 'm',
    units: [
      // 尺貫法
      { id: 'rin',   label: '厘',  type: 'shaku', factor: 1 / 3300 },
      { id: 'bu',    label: '分',  type: 'shaku', factor: 1 / 330  },
      { id: 'sun',   label: '寸',  type: 'shaku', factor: 1 / 33   },
      { id: 'shaku', label: '尺',  type: 'shaku', factor: 10 / 33  },
      { id: 'ken',   label: '間',  type: 'shaku', factor: 60 / 33  },
      { id: 'jo',    label: '丈',  type: 'shaku', factor: 100 / 33 },
      // メートル法
      { id: 'mm',    label: 'mm',  type: 'metric', factor: 0.001  },
      { id: 'cm',    label: 'cm',  type: 'metric', factor: 0.01   },
      { id: 'm',     label: 'm',   type: 'metric', factor: 1      },
    ],
  },
  area: {
    label: '面積',
    baseLabel: 'm²',
    units: [
      // 尺貫法
      { id: 'jo',    label: '畳',  type: 'shaku', factor: 200 / 121 }, // 0.5坪
      { id: 'tsubo', label: '坪',  type: 'shaku', factor: 400 / 121 }, // 1間²
      // メートル法
      { id: 'm2',    label: 'm²',  type: 'metric', factor: 1    },
    ],
  },
  volume: {
    label: '体積・容積',
    baseLabel: 'L',
    units: [
      // 尺貫法
      { id: 'go',   label: '合',  type: 'shaku', factor: 0.18039  },
      { id: 'sho',  label: '升',  type: 'shaku', factor: 1.8039   },
      { id: 'to',   label: '斗',  type: 'shaku', factor: 18.039   },
      { id: 'koku', label: '石',  type: 'shaku', factor: 180.39   },
      // メートル法
      { id: 'ml',   label: 'mL', type: 'metric', factor: 0.001  },
      { id: 'l',    label: 'L',  type: 'metric', factor: 1      },
      { id: 'm3',   label: 'm³', type: 'metric', factor: 1000   },
    ],
  },
};

// ===== 数値フォーマット =====
function fmt(n) {
  if (n === 0) return '0';
  const abs = Math.abs(n);

  // 有効数字4桁を基本とする
  if (abs >= 10000) {
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 0 });
  }
  if (abs >= 1000) {
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 1 });
  }
  if (abs >= 100) {
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  }
  if (abs >= 10) {
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 3 });
  }
  if (abs >= 1) {
    return n.toLocaleString('ja-JP', { maximumFractionDigits: 4 });
  }
  if (abs >= 0.01) {
    return n.toFixed(5).replace(/\.?0+$/, '');
  }
  // 非常に小さい値
  return n.toPrecision(4);
}

// ===== 変換計算 =====
function convert(value, fromFactor, toFactor) {
  return value * fromFactor / toFactor;
}

// ===== UI 初期化 =====
function initCategory(catId) {
  const cat = CATEGORIES[catId];
  const inputEl  = document.getElementById(`${catId}-input`);
  const fromEl   = document.getElementById(`${catId}-from`);
  const resultsEl = document.getElementById(`${catId}-results`);

  // セレクトボックス構築
  const shakuGroup  = document.createElement('optgroup');
  shakuGroup.label  = '尺貫法';
  const metricGroup = document.createElement('optgroup');
  metricGroup.label = 'メートル法';

  cat.units.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.label;
    (u.type === 'shaku' ? shakuGroup : metricGroup).appendChild(opt);
  });

  fromEl.appendChild(shakuGroup);
  fromEl.appendChild(metricGroup);

  // デフォルト選択
  const defaultUnit = catId === 'length' ? 'shaku'
                    : catId === 'area'   ? 'tsubo'
                    : 'sho';
  fromEl.value = defaultUnit;

  // 変換実行
  function doConvert() {
    const raw = parseFloat(inputEl.value);
    if (isNaN(raw) || inputEl.value === '') {
      resultsEl.innerHTML = '<p class="empty-state">数値を入力すると各単位に変換します</p>';
      return;
    }

    const fromId = fromEl.value;
    const fromUnit = cat.units.find(u => u.id === fromId);

    // 結果カードを生成
    const frag = document.createDocumentFragment();

    cat.units.forEach(u => {
      const result = convert(raw, fromUnit.factor, u.factor);

      const div = document.createElement('div');
      div.className = `result-item ${u.type}`;
      if (u.id === fromId) div.classList.add('active-unit');

      const label = document.createElement('div');
      label.className = 'result-label';
      label.textContent = u.label;

      const val = document.createElement('div');
      val.className = 'result-value';
      val.textContent = fmt(result);

      div.appendChild(label);
      div.appendChild(val);
      frag.appendChild(div);
    });

    // 凡例
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML =
      '<span><span class="legend-dot" style="background:#eef4fb;border:1px solid #b8d0e8"></span>尺貫法</span>' +
      '<span><span class="legend-dot" style="background:#faf4ee;border:1px solid #e0c9b0"></span>メートル法</span>';

    resultsEl.innerHTML = '';
    resultsEl.appendChild(frag);
    resultsEl.appendChild(legend);
  }

  inputEl.addEventListener('input', doConvert);
  fromEl.addEventListener('change', doConvert);

  // 初期表示
  doConvert();

  // 換算表を構築
  buildTable(catId);
}

// ===== 換算早見表 =====
function buildTable(catId) {
  const cat   = CATEGORIES[catId];
  const table = document.getElementById(`${catId}-table`);
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  // ヘッダー行
  const headerRow = document.createElement('tr');

  const thEmpty = document.createElement('th');
  thEmpty.textContent = '1 [単位]';
  headerRow.appendChild(thEmpty);

  cat.units.forEach(u => {
    const th = document.createElement('th');
    th.textContent = u.label;
    th.className = u.type === 'shaku' ? 'shaku-header' : 'metric-header';
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);

  // データ行（各単位を基準に全単位への換算）
  cat.units.forEach(fromUnit => {
    const tr = document.createElement('tr');

    const tdLabel = document.createElement('td');
    tdLabel.textContent = `1 ${fromUnit.label}`;
    tr.appendChild(tdLabel);

    cat.units.forEach(toUnit => {
      const td  = document.createElement('td');
      const val = convert(1, fromUnit.factor, toUnit.factor);
      td.textContent = fmt(val);
      if (fromUnit.id === toUnit.id) td.style.fontWeight = '700';
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ===== タブ切り替え =====
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    document.querySelectorAll('.tab').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });

    document.querySelectorAll('.tab-content').forEach(sec => {
      sec.classList.toggle('active', sec.id === target);
    });
  });
});

// ===== 起動 =====
initCategory('length');
initCategory('area');
initCategory('volume');
