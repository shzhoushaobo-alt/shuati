const STORAGE_WRONG = "ai_quiz_wrong_ids_v1";
const STORAGE_ANSWERS = "ai_quiz_answers_v1";
const STORAGE_PRACTICE_TOTAL = "ai_quiz_practice_total_v1";

const state = {
  questions: [],
  byId: new Map(),
  wrongSet: new Set(),
  answersMap: {},
  practiceQueue: [],
  practiceIndex: 0,
  testQueue: [],
  testAnswers: {},
  activeTab: "practice",
  practiceRoundAnswered: 0,
  practiceTotalAnswered: 0,
};

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getCorrectAnswer(question) {
  const local = state.answersMap[String(question.id)];
  if (Array.isArray(local) && local.length) return local;
  if (Array.isArray(question.answer) && question.answer.length) return question.answer;
  return [];
}

function saveWrongSet() {
  localStorage.setItem(STORAGE_WRONG, JSON.stringify([...state.wrongSet]));
}

function saveAnswersMap() {
  localStorage.setItem(STORAGE_ANSWERS, JSON.stringify(state.answersMap));
}

function setFinalAnswer(questionId, answerArr) {
  state.answersMap[String(questionId)] = answerArr.map((x) => String(x).toUpperCase());
  saveAnswersMap();
  setMetaText();
  renderWrongBook();
}

function loadLocalData() {
  try {
    const wrong = JSON.parse(localStorage.getItem(STORAGE_WRONG) || "[]");
    state.wrongSet = new Set(wrong.map((x) => Number(x)));
  } catch (_) {}

  try {
    const answers = JSON.parse(localStorage.getItem(STORAGE_ANSWERS) || "{}");
    if (answers && typeof answers === "object") state.answersMap = answers;
  } catch (_) {}

  try {
    state.practiceTotalAnswered = Number(localStorage.getItem(STORAGE_PRACTICE_TOTAL) || "0");
  } catch (_) {}
}

function setMetaText() {
  const total = state.questions.length;
  const known = state.questions.filter((q) => getCorrectAnswer(q).length > 0).length;
  document.getElementById("metaText").textContent = `共 ${total} 题，已录入答案 ${known} 题，错题本 ${state.wrongSet.size} 题`;
}

function renderPracticeStats() {
  const total = state.practiceQueue.length;
  const current = total ? state.practiceIndex + 1 : 0;
  document.getElementById("practiceStats").textContent =
    `本轮进度：第 ${current}/${total} 题 · 本轮已作答 ${state.practiceRoundAnswered} 题 · 累计已刷 ${state.practiceTotalAnswered} 题`;
}

function renderQuestionCard(question, selected = [], reveal = false) {
  const answer = getCorrectAnswer(question);
  const answerSet = new Set(answer);
  const selectedSet = new Set(selected);
  const typeLabelMap = {
    single: "单选题",
    multi: "多选题",
    judge: "判断题",
  };
  const typeLabel = typeLabelMap[question.type] || question.type;

  const optionHtml = question.options
    .map((opt) => {
      const isSelected = selectedSet.has(opt.key);
      const isCorrect = answerSet.has(opt.key);
      const classList = ["opt"];
      if (isSelected) classList.push("selected");
      if (reveal && isCorrect) classList.push("correct");
      if (reveal && isSelected && !isCorrect) classList.push("wrong");
      return `<button class="${classList.join(" ")}" data-key="${opt.key}">${opt.key}. ${opt.text}</button>`;
    })
    .join("");

  return `
    <article class="card">
      <div class="q-meta">第${question.id}题 · ${typeLabel}</div>
      <p class="q-title">${question.question}</p>
      <div class="options">${optionHtml}</div>
      <div class="result" id="cardResult"></div>
    </article>
  `;
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`panel${tab[0].toUpperCase()}${tab.slice(1)}`).classList.add("active");
}

function initPractice(withWrongOnly = false) {
  const source = withWrongOnly
    ? state.questions.filter((q) => state.wrongSet.has(q.id))
    : state.questions;
  state.practiceQueue = shuffle(source);
  state.practiceIndex = 0;
  state.practiceRoundAnswered = 0;
  renderPracticeCurrent();
  renderPracticeStats();
}

function renderPracticeCurrent() {
  const root = document.getElementById("practiceContainer");
  if (!state.practiceQueue.length) {
    root.innerHTML = `<div class="card">当前题集为空。</div>`;
    return;
  }
  const q = state.practiceQueue[state.practiceIndex];
  root.innerHTML = renderQuestionCard(q);
  const opts = root.querySelectorAll(".opt");
  let answeredThisCard = false;

  opts.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!answeredThisCard) {
        answeredThisCard = true;
        state.practiceRoundAnswered += 1;
        state.practiceTotalAnswered += 1;
        localStorage.setItem(STORAGE_PRACTICE_TOTAL, String(state.practiceTotalAnswered));
        renderPracticeStats();
      }
      const selected = [btn.dataset.key];
      const answer = getCorrectAnswer(q);
      root.innerHTML = renderQuestionCard(q, selected, true);
      const result = root.querySelector("#cardResult");

      if (!answer.length) {
        result.textContent = "此题暂无标准答案。你可以在“答案管理”里导入，或在下方设置本题答案。";
        const actions = document.createElement("div");
        actions.className = "actions";
        q.options.forEach((opt) => {
          const setBtn = document.createElement("button");
          setBtn.textContent = `设 ${opt.key} 为答案`;
          setBtn.addEventListener("click", () => {
            setFinalAnswer(q.id, [opt.key]);
            renderPracticeCurrent();
          });
          actions.appendChild(setBtn);
        });
        root.querySelector(".card").appendChild(actions);
        return;
      }

      const ok = answer.length === 1 && answer[0] === selected[0];
      if (ok) {
        result.textContent = `回答正确。标准答案：${answer.join(", ")}`;
        if (state.wrongSet.has(q.id)) {
          state.wrongSet.delete(q.id);
          saveWrongSet();
          setMetaText();
        }
      } else {
        result.textContent = `回答错误。标准答案：${answer.join(", ")}`;
        state.wrongSet.add(q.id);
        saveWrongSet();
        setMetaText();
      }

      const actions = document.createElement("div");
      actions.className = "actions";
      const setFinalBtn = document.createElement("button");
      setFinalBtn.textContent = `将当前作答设为最终答案（${selected.join(", ")}）`;
      setFinalBtn.addEventListener("click", () => {
        setFinalAnswer(q.id, selected);
        result.textContent = `已更新最终答案：${selected.join(", ")}（立即生效）`;
        renderPracticeCurrent();
      });
      actions.appendChild(setFinalBtn);
      root.querySelector(".card").appendChild(actions);
    });
  });
}

function nextPractice() {
  if (!state.practiceQueue.length) return;
  state.practiceIndex = (state.practiceIndex + 1) % state.practiceQueue.length;
  renderPracticeCurrent();
  renderPracticeStats();
}

function startTest() {
  const onlyWrong = document.getElementById("testOnlyWrong").checked;
  const pool = onlyWrong ? state.questions.filter((q) => state.wrongSet.has(q.id)) : state.questions;
  const singles = shuffle(pool.filter((q) => q.type === "single")).slice(0, 70);
  const judges = shuffle(pool.filter((q) => q.type === "judge")).slice(0, 20);
  const multis = shuffle(pool.filter((q) => q.type === "multi")).slice(0, 10);
  const source = [...singles, ...multis, ...judges];
  state.testQueue = source;
  state.testAnswers = {};
  const root = document.getElementById("testContainer");
  const submitBtn = document.getElementById("testSubmitBtn");
  if (!source.length) {
    root.innerHTML = `<div class="card">当前题集为空。</div>`;
    submitBtn.disabled = true;
    return;
  }

  const renderSection = (title, arr) => {
    if (!arr.length) return "";
    const sectionItems = arr
      .map((q) => {
      const opts = q.options
        .map((o) => `<button class="opt" data-qid="${q.id}" data-key="${o.key}">${o.key}. ${o.text}</button>`)
        .join("");
      const typeLabelMap = { single: "单选题", multi: "多选题", judge: "判断题" };
      const typeLabel = typeLabelMap[q.type] || q.type;
      return `<article class="card"><div class="q-meta">第${q.id}题 · ${typeLabel}</div><p class="q-title">${q.question}</p><div class="options">${opts}</div></article>`;
    })
      .join("");
    return `<h3>${title}</h3><div class="list">${sectionItems}</div>`;
  };

  root.innerHTML = `<div class="result">本次测试共 ${source.length} 题（单选 ${singles.length} / 多选 ${multis.length} / 判断 ${judges.length}；每题1分）</div>${
    renderSection("一、单选题", singles)
  }${renderSection("二、多选题", multis)}${renderSection("三、判断题", judges)}`;
  submitBtn.disabled = false;
  document.getElementById("testResult").textContent = "";

  root.querySelectorAll(".opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const qid = Number(btn.dataset.qid);
      const key = btn.dataset.key;
      const q = state.byId.get(qid);
      if (q && q.type === "multi") {
        const curr = new Set(state.testAnswers[qid] || []);
        if (curr.has(key)) curr.delete(key);
        else curr.add(key);
        state.testAnswers[qid] = [...curr];
        const siblings = root.querySelectorAll(`button[data-qid="${qid}"]`);
        siblings.forEach((el) => {
          el.classList.toggle("selected", (state.testAnswers[qid] || []).includes(el.dataset.key));
        });
      } else {
        state.testAnswers[qid] = [key];
        const siblings = root.querySelectorAll(`button[data-qid="${qid}"]`);
        siblings.forEach((el) => el.classList.remove("selected"));
        btn.classList.add("selected");
      }
    });
  });
}

function submitTest() {
  if (!state.testQueue.length) return;
  if (!window.confirm("确认交卷吗？交卷后将立即计算分数。")) return;
  let knownTotal = 0;
  let score = 0;
  const wrongIds = [];
  const unknownIds = [];

  state.testQueue.forEach((q) => {
    const answer = getCorrectAnswer(q);
    const selected = state.testAnswers[q.id] || [];
    if (!answer.length) {
      unknownIds.push(q.id);
      return;
    }
    knownTotal += 1;
    const ok = answer.length === selected.length && answer.every((x) => selected.includes(x));
    const itemScore = 1;
    if (ok) {
      score += itemScore;
      if (state.wrongSet.has(q.id)) state.wrongSet.delete(q.id);
    } else {
      wrongIds.push(q.id);
      state.wrongSet.add(q.id);
    }
  });
  saveWrongSet();
  setMetaText();

  const result = [
    `已判分题数：${knownTotal}`,
    `得分：${score}`,
    `满分：100（每题1分；单选70 + 多选10 + 判断20）`,
    `错误题号：${wrongIds.length ? wrongIds.join(", ") : "无"}`,
    `未录入标准答案题号：${unknownIds.length ? unknownIds.join(", ") : "无"}`,
  ].join("\n");
  document.getElementById("testResult").textContent = result;
  renderWrongBook();
}

function renderWrongBook() {
  const root = document.getElementById("wrongContainer");
  const ids = [...state.wrongSet];
  if (!ids.length) {
    root.innerHTML = `<div class="card">错题本为空。</div>`;
    return;
  }
  const html = ids
    .map((id) => {
      const q = state.byId.get(id);
      if (!q) return "";
      const answer = getCorrectAnswer(q);
      const typeLabelMap = { single: "单选题", multi: "多选题", judge: "判断题" };
      const typeLabel = typeLabelMap[q.type] || q.type;
      return `<article class="card"><div class="q-meta">第${q.id}题 · ${typeLabel}</div><p class="q-title">${q.question}</p><div class="chip">答案：${answer.length ? answer.join(", ") : "未录入"}</div></article>`;
    })
    .join("");
  root.innerHTML = `<div class="list">${html}</div>`;
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.getElementById("practiceNextBtn").addEventListener("click", nextPractice);
  document.getElementById("testStartBtn").addEventListener("click", startTest);
  document.getElementById("testSubmitBtn").addEventListener("click", submitTest);
  document.getElementById("wrongStartPracticeBtn").addEventListener("click", () => {
    switchTab("practice");
    initPractice(true);
  });
  document.getElementById("wrongClearBtn").addEventListener("click", () => {
    state.wrongSet.clear();
    saveWrongSet();
    setMetaText();
    renderWrongBook();
  });
  document.getElementById("exportAnswersBtn").addEventListener("click", () => {
    const text = JSON.stringify(state.answersMap, null, 2);
    document.getElementById("answersInput").value = text;
    document.getElementById("manageMessage").textContent = "已导出到下方文本框。";
  });
  document.getElementById("importAnswersBtn").addEventListener("click", () => {
    const message = document.getElementById("manageMessage");
    const text = document.getElementById("answersInput").value.trim();
    try {
      const incoming = JSON.parse(text);
      if (!incoming || typeof incoming !== "object") throw new Error("格式错误");
      let count = 0;
      Object.entries(incoming).forEach(([id, ans]) => {
        if (Array.isArray(ans) && ans.length) {
          state.answersMap[id] = ans.map((x) => String(x).toUpperCase());
          count += 1;
        }
      });
      saveAnswersMap();
      setMetaText();
      renderPracticeCurrent();
      renderWrongBook();
      message.textContent = `导入成功：${count} 题。`;
    } catch (err) {
      message.textContent = `导入失败：${err.message}`;
    }
  });
}

async function bootstrap() {
  loadLocalData();
  const res = await fetch("./questions.json");
  state.questions = await res.json();
  state.byId = new Map(state.questions.map((q) => [q.id, q]));
  setMetaText();
  bindEvents();
  initPractice(false);
  renderWrongBook();
}

bootstrap().catch((err) => {
  document.getElementById("metaText").textContent = `加载失败：${err.message}`;
});
