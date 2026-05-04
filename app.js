// ==========================================
// 🐱 喵逮雞 POS 系統 - 核心神經網路 (app.js)
// ==========================================

// ⚠️ 徒兒請注意：請務必將下方網址換成您自己真實的 Cloud Run 端點！
const API_URL = "https://whatthemeownews-erp-backend-324921111026.europe-west1.run.app"; 

// 店內菜單
const menuItems = [
    { name: "菜脯米", price: 30 },
    { name: "金沙", price: 35 },
    { name: "泰奶", price: 35 },
    { name: "起司", price: 35 },
    { name: "鮪玉", price: 30 },
    { name: "草莓", price: 30 },
    { name: "抹茶", price: 30 },
    { name: "巧克力", price: 30 },
    { name: "卡士達", price: 25 },
    { name: "原味", price: 20 }
];

// ================= 初始化頁面 =================
document.addEventListener("DOMContentLoaded", () => {
    updateClock();
    setInterval(updateClock, 1000);
    renderTable();
    setupThemeToggle();
});

// 時鐘功能
function updateClock() {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString('zh-TW', { hour12: false });
    document.getElementById('date').innerText = now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

// ================= 生成完美比例點餐表格 =================
function renderTable() {
    const headerRow = document.getElementById('header-row');
    const tbody = document.getElementById('order-body');
    
    // 正確平鋪生成表頭，解決疊羅漢問題
    let headersHtml = `<th>收💰</th><th>No</th>`;
    headersHtml += menuItems.map(item => `<th>${item.name}<br><small>(${item.price})</small></th>`).join('');
    headersHtml += `<th>總額</th><th>語音/備註</th>`;
    headerRow.innerHTML = headersHtml;

    // 生成 10 列訂單
    let rowsHtml = '';
    for (let i = 1; i <= 10; i++) {
        let rowId = i.toString().padStart(2, '0');
        
        let inputsHtml = menuItems.map(item => `
            <td>
                <input type="number" min="0" class="qty-input" id="qty-${rowId}-${item.name}" data-price="${item.price}" data-row="${rowId}" onchange="calculateTotal('${rowId}')">
            </td>
        `).join('');

        rowsHtml += `
            <tr id="row-${rowId}">
                <td style="text-align: center;"><input type="checkbox" id="paid-${rowId}" class="paid-checkbox" style="transform: scale(1.5);"></td>
                <td style="font-weight: bold; text-align: center;">${rowId}</td>
                ${inputsHtml}
                <td class="total-price" id="total-${rowId}" style="font-weight: bold; color: #e74c3c;">$0</td>
                
                <!-- 黑科技操作區 -->
                <td style="display: flex; gap: 4px; justify-content: center; align-items: center; padding: 5px;">
                    <button class="btn btn-voice" onclick="startVoiceOrder('${rowId}')" style="padding: 6px 10px;"><i class="fas fa-microphone"></i></button>
                    <input type="text" id="note-${rowId}" placeholder="備註..." style="width: 70px; padding: 4px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc;">
                    <button class="btn btn-danger" onclick="clearRow('${rowId}')" title="清空此列" style="padding: 6px 10px;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = rowsHtml;
}

// ================= 核心計算與清空邏輯 =================
function calculateTotal(rowId) {
    let total = 0;
    menuItems.forEach(item => {
        let qty = document.getElementById(`qty-${rowId}-${item.name}`).value;
        if (qty > 0) {
            total += qty * item.price;
        }
    });
    document.getElementById(`total-${rowId}`).innerText = `$${total}`;
}

function clearRow(rowId) {
    // 一鍵清空整行
    menuItems.forEach(item => {
        document.getElementById(`qty-${rowId}-${item.name}`).value = '';
    });
    document.getElementById(`paid-${rowId}`).checked = false;
    document.getElementById(`note-${rowId}`).value = '';
    document.getElementById(`row-${rowId}`).style.backgroundColor = ''; // 恢復背景色
    calculateTotal(rowId);
}

// ================= 語音與 AI 黑科技串接 =================
function startVoiceOrder(rowId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("大師提醒：您的瀏覽器不支援語音辨識，請在 iPhone 上使用 Safari 瀏覽器開啟喔！");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.interimResults = false;

    // 正在聆聽的 UI 提示
    const voiceBtn = document.querySelector(`#row-${rowId} .btn-voice`);
    const originalHtml = voiceBtn.innerHTML;
    voiceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    voiceBtn.style.backgroundColor = '#e74c3c';

    recognition.start();

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log(`客席 ${rowId} 收到語音指令:`, transcript);
        sendToGemini(rowId, transcript, voiceBtn, originalHtml);
    };

    recognition.onerror = (event) => {
        console.error("語音辨識錯誤:", event.error);
        alert("聽不清楚，請再試一次！");
        resetVoiceBtn(voiceBtn, originalHtml);
    };
    
    recognition.onend = () => {
        if(voiceBtn.style.backgroundColor === 'rgb(231, 76, 60)') {
           resetVoiceBtn(voiceBtn, originalHtml);
        }
    }
}

function sendToGemini(rowId, transcript, voiceBtn, originalHtml) {
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcript })
    })
    .then(response => response.json())
    .then(data => {
        // 抓取解析出來的 JSON
        const parsedData = data.parsed_json || data; 
        console.log("大師解析結果:", parsedData);

        // 🛑 黑科技二：清空指令攔截
        if (parsedData.action === "clear") {
            clearRow(rowId);
            resetVoiceBtn(voiceBtn, originalHtml);
            return; 
        }

        // ✍️ 黑科技一：自動填寫備註
        if (parsedData.note) {
            document.getElementById(`note-${rowId}`).value = parsedData.note;
        }

        // ✅ 已收款神技：自動打勾並改變背景色亮起綠燈
        if (parsedData.is_paid === true) {
            document.getElementById(`paid-${rowId}`).checked = true;
            document.getElementById(`row-${rowId}`).style.backgroundColor = 'rgba(46, 204, 113, 0.15)';
        }

        // 填寫數量
        menuItems.forEach(item => {
            if (parsedData[item.name]) {
                document.getElementById(`qty-${rowId}-${item.name}`).value = parsedData[item.name];
            }
        });

        // 重新計算總額
        calculateTotal(rowId);
        resetVoiceBtn(voiceBtn, originalHtml);
    })
    .catch(error => {
        console.error("API 呼叫失敗:", error);
        alert("大師神經網路斷線啦！請檢查伺服器或再試一次。");
        resetVoiceBtn(voiceBtn, originalHtml);
    });
}

function resetVoiceBtn(btn, originalHtml) {
    btn.innerHTML = originalHtml;
    btn.style.backgroundColor = '';
}

// ================= 淺色/深色模式切換 =================
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        if (document.body.classList.contains('dark-theme')) {
            toggleBtn.innerText = '[ 淺色模式 ]';
            toggleBtn.className = 'btn btn-secondary';
        } else {
            toggleBtn.innerText = '[ 深色模式 ]';
            toggleBtn.className = 'btn btn-dark';
        }
    });
}
