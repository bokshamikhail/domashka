// ====== helpers ======
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ====== chatbot logic ======
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function findReply(text) {
  const t = normalize(text);

  const rules = [
    { keys: ["привет", "hello", "hi", "здрав"], replies: ["Привет! 🙂", "О, привет!", "Привет-привет! Чем помочь?"] },
    { keys: ["вшэ", "hse"], replies: ["ВШЭ — топ 🙂", "Да, учусь в ВШЭ. Что интересно узнать?", "Про ВШЭ могу рассказать: что именно?"] },
    { keys: ["проект", "домаш", "дз", "лаба"], replies: ["По проектам я люблю короткие итерации.", "ДЗ делаю аккуратно: структура, стиль, проверка.", "Скидывай требования — подстроим."] },
    { keys: ["спасибо", "thx", "thanks"], replies: ["Пожалуйста! 😄", "Всегда рад помочь.", "Обращайся!"] },
    { keys: ["как дела", "как ты"], replies: ["Отлично! Готов отвечать 🙂", "Нормально, код пишется 😄", "Супер. Ты как?"] },
    { keys: ["карта", "openlayers", "ol"], replies: ["Карту уже встроили через OpenLayers.", "Да, OpenLayers — удобная штука.", "Хочешь, добавлю маркер или поиск?"] },
  ];

  for (const r of rules) {
    if (r.keys.some(k => t.includes(k))) return pick(r.replies);
  }

  // fallback случайные ответы
  return pick([
    "Интересно! Расскажи подробнее.",
    "Ок 🙂 А что именно ты хочешь узнать?",
    "Понял. Давай уточним: ты про учёбу или про проект?",
    "Хороший вопрос. Можешь переформулировать?",
  ]);
}

// ====== chat UI ======
function addMsg(list, who, text, kind = "text") {
  const item = el("div", `msg ${who}`);
  const bubble = el("div", "bubble");
  const meta = el("div", "meta", `${who === "me" ? "Вы" : "Автор"} • ${nowTime()}`);

  if (kind === "audio" && text instanceof Blob) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = URL.createObjectURL(text);
    bubble.appendChild(audio);
  } else {
    bubble.textContent = text;
  }

  item.appendChild(meta);
  item.appendChild(bubble);
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;
}

// ====== voice recording ======
async function setupRecorder(btn, statusEl) {
  let mediaRecorder = null;
  let chunks = [];
  let isRecording = false;

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.start();
    isRecording = true;
    btn.textContent = "⏹ Остановить запись";
    statusEl.textContent = "Запись идёт…";
  }

  async function stop() {
    return new Promise((resolve) => {
      if (!mediaRecorder) return resolve(null);

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        // выключаем микрофон
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        mediaRecorder = null;
        isRecording = false;
        btn.textContent = "🎙 Записать голос";
        statusEl.textContent = "Голосовое готово к отправке";
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }

  return {
    get isRecording() { return isRecording; },
    start,
    stop
  };
}

// ====== Map (OpenLayers) ======
function initMap() {
  // OpenLayers uses global "ol" from CDN
  const center = ol.proj.fromLonLat([37.6173, 55.7558]); // Москва
  const map = new ol.Map({
    target: "map",
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      })
    ],
    view: new ol.View({
      center,
      zoom: 11
    })
  });

  // Маркер (пример)
  const marker = new ol.Feature(new ol.geom.Point(center));
  const vectorSource = new ol.source.Vector({ features: [marker] });
  const vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: new ol.style.Style({
      image: new ol.style.Circle({
        radius: 7,
        fill: new ol.style.Fill({ color: "#4da3ff" }),
        stroke: new ol.style.Stroke({ color: "#ffffff", width: 2 })
      })
    })
  });
  map.addLayer(vectorLayer);
}

// ====== window.onload: DOM + handlers ======
window.onload = async function () {
  // map
  if (document.getElementById("map")) {
    initMap();
  }

  // chat
  const list = document.getElementById("chatList");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const recBtn = document.getElementById("recBtn");
  const voiceSendBtn = document.getElementById("voiceSendBtn");
  const voiceStatus = document.getElementById("voiceStatus");

  if (!list) return;

  addMsg(list, "bot", "Привет! Я виртуальный чат автора страницы. Можешь написать сообщение или отправить голосовое 🙂");

  // Enter to send
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendBtn.click();
  });

  sendBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    addMsg(list, "me", text);
    input.value = "";

    // автоответ с небольшой задержкой
    const reply = findReply(text);
    const delay = 450 + Math.random() * 700;
    setTimeout(() => addMsg(list, "bot", reply), delay);
  });

  // voice
  let lastVoiceBlob = null;
  let recorder = null;

  if (navigator.mediaDevices && window.MediaRecorder) {
    recorder = await setupRecorder(recBtn, voiceStatus);

    recBtn.addEventListener("click", async () => {
      try {
        if (!recorder.isRecording) {
          voiceStatus.textContent = "Запрашиваю доступ к микрофону…";
          await recorder.start();
        } else {
          lastVoiceBlob = await recorder.stop();
          voiceSendBtn.disabled = !lastVoiceBlob;
        }
      } catch (e) {
        voiceStatus.textContent = "Не удалось получить доступ к микрофону (проверь разрешения браузера).";
      }
    });

    voiceSendBtn.addEventListener("click", () => {
      if (!lastVoiceBlob) return;
      addMsg(list, "me", lastVoiceBlob, "audio");
      lastVoiceBlob = null;
      voiceSendBtn.disabled = true;
      voiceStatus.textContent = "Голосовое отправлено (фиктивно)";

      // автоответ на голосовое (случайный)
      setTimeout(() => addMsg(list, "bot", pick([
        "Услышал! 🙂 (ответ фиктивный)",
        "Спасибо за голосовое! (на сервер ничего не отправлялось)",
        "Принято. Могу помочь с ДЗ или проектом?"
      ])), 600 + Math.random() * 700);
    });

  } else {
    recBtn.disabled = true;
    voiceSendBtn.disabled = true;
    voiceStatus.textContent = "Голосовые недоступны в этом браузере.";
  }
};
