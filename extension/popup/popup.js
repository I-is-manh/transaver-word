(async () => {
  const TV = globalThis.TV;
  const $ = (id) => document.getElementById(id);

  const src = $('src');
  const tgt = $('tgt');
  const swap = $('swap');
  const saved = $('saved');
  const input = $('input');
  const count = $('count');
  const translateBtn = $('translate');
  const result = $('result');
  const showIcon = $('showIcon');
  const highlight = $('highlight');

  swap.appendChild(TV.icon('swap', 20));
  TV.fillSelect(src, { includeAuto: true, compact: true });
  TV.fillSelect(tgt, { includeAuto: false, compact: true });

  let settings = await TV.getSettings();
  render();

  function render() {
    src.value = settings.sourceLang;
    tgt.value = settings.targetLang;
    showIcon.checked = settings.showIcon;
    highlight.checked = settings.highlight !== false;
    swap.disabled = settings.sourceLang === TV.AUTO;
    swap.title =
      settings.sourceLang === TV.AUTO ? 'Chọn ngôn ngữ nguồn cụ thể để đổi chiều' : 'Đổi chiều dịch';
  }

  let savedTimer;
  async function save(patch) {
    settings = await TV.saveSettings(patch);
    render();
    saved.textContent = `Đã lưu: ${TV.langName(settings.sourceLang)} sang ${TV.langName(settings.targetLang)}`;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (saved.textContent = ''), 2000);
  }

  src.addEventListener('change', () => save({ sourceLang: src.value }));
  tgt.addEventListener('change', () => save({ targetLang: tgt.value }));
  swap.addEventListener('click', () => {
    if (settings.sourceLang === TV.AUTO) return;
    save({ sourceLang: settings.targetLang, targetLang: settings.sourceLang });
  });
  showIcon.addEventListener('change', () => save({ showIcon: showIcon.checked }));
  highlight.addEventListener('change', async () => {
    settings = await TV.saveSettings({ highlight: highlight.checked });
    render();
  });

  input.addEventListener('input', () => {
    count.textContent = `${input.value.length}/${TV.MAX_TEXT_LENGTH}`;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runTranslate();
  });
  translateBtn.addEventListener('click', runTranslate);

  async function runTranslate() {
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    translateBtn.disabled = true;
    showResult('Đang dịch…', false);
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'TV_TRANSLATE',
        text,
        sourceLang: settings.sourceLang,
        targetLang: settings.targetLang,
      });
      if (!res?.ok) throw new Error(res?.error || 'Dịch thất bại.');
      showResult(decodeEntities(res.data.translation), false);
      if (settings.sourceLang === TV.AUTO && res.data.detectedLang) {
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = `Phát hiện: ${TV.langName(res.data.detectedLang)}`;
        result.appendChild(meta);
      }
    } catch (err) {
      showResult(err.message || String(err), true);
    } finally {
      translateBtn.disabled = false;
    }
  }

  function showResult(text, isError) {
    result.hidden = false;
    result.textContent = text;
    result.classList.toggle('error', isError);
  }

  function decodeEntities(str) {
    const t = document.createElement('textarea');
    t.innerHTML = str;
    return t.value;
  }
})();
