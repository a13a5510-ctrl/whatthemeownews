const API_BASE_URL = "https://whatthemeownews-erp-backend-324921111026.europe-west1.run.app";
let products = [];
let activeInput = null;
let currentNoteRow = null;
let currentRowCount = 10; 
let baseServerReceived = 0; 
let speechRecognition = null; 
let rowSpeechRecognition = null;

window.onload = async () => {
    updateDateDisplay();
    setInterval(updateDateDisplay, 60000);
    
    await fetchProductsFromCloud();
    await fetchTodayStats();
    initVirtualKeypad();
};

function updateDateDisplay() {
    const now = new Date();
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;
    const dayStr = `星期${days[now.getDay()]}`;
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    // 如果這兩個 element 不存在，就忽略
    const dateDisplay = document.getElementById('dateDisplay');
    if (dateDisplay) {
        dateDisplay.innerHTML = `🕒 ${dateStr} ${dayStr} <span style="color:#38bdf8; margin-left:8px; font-size:18px;">${timeStr}</span>`;
    }
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2800);
}

async function fetchProductsFromCloud() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/products`);
        const result = await res.json();
        if (result.status === 'success') {
            products = result.data;
            renderTableHeader();
            renderTableRows(1, currentRowCount);
        }
    } catch (e) {
        document.getElementById('headerRow').innerHTML = "<th style='color:red;'>無法連線到雲端伺服器！</th>";
    }
}

async function fetchTodayStats() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/stats/today`);
        const result = await res.json();
        if (result.status === 'success') {
            document.getElementById('dashCount').textContent = result.data.total_orders_count;
            baseServerReceived = result.data.revenue_received;
            updateLiveRevenue(); 
        }
    } catch (e) { console.log("業績同步失敗", e); }
}

function updateLiveRevenue() {
    let localReceived = 0;
    for(let i=1; i<=currentRowCount; i++) {
        let rawTotal = parseInt(document.getElementById(`total-${i}`).dataset.rawTotal) || 0;
        let isChecked = document.querySelector(`#row-${i} .received-cb`).checked;
        if(isChecked && rawTotal > 0) {
            localReceived += rawTotal;
        }
    }
    document.getElementById('dashTotal').textContent = `$${(baseServerReceived + localReceived).toLocaleString()}`;
}

function renderTableHeader() {
    const tr = document.getElementById('headerRow');
    let html = `
        <th style="width: 50px; text-align: center;">收💸</th>
        <th style="width: 50px; text-align: center;">No</th>
    `;
    products.forEach(p => {
        html += `<th style="text-align: center;">${p.name}<span class="th-price">(${p.price})</span></th>`;
    });
    html += `<th style="width: 80px; text-align: center;">總額</th><th style="width: 100px; text-align: center;">語音/備註</th>`;
    tr.innerHTML = html;
}

let pressTimer;
function startLongPress(rowNum, element) {
    element.classList.add('pressing');
    pressTimer = setTimeout(() => {
        clearSpecificRow(rowNum);
        if (navigator.vibrate) navigator.vibrate(100);
        showToast(`🧹 第 ${rowNum} 行資料已清空`);
    }, 2000);
}

function cancelLongPress(element) {
    clearTimeout(pressTimer);
    element.classList.remove('pressing');
}

function clearSpecificRow(rowNum) {
    const cb = document.querySelector(`#row-${rowNum} .received-cb`);
    if(cb) cb.checked = false;
    document.querySelectorAll(`input[data-row="${rowNum}"]`).forEach(inp => inp.value = '');
    calculateRowTotal(rowNum);
    document.getElementById(`noteVal-${rowNum}`).value = '';
    const noteBtn = document.getElementById(`noteBtn-${rowNum}`);
    noteBtn.classList.remove('has-note');
    noteBtn.textContent = '📝';
    document.getElementById(`row-${rowNum}`).style.backgroundColor = ''; 
}

function generateRowHTML(i) {
    let rowHtml = `
        <tr id="row-${i}">
            <td style="text-align: center;">
                <input type="checkbox" class="received-cb" data-row="${i}" style="width:24px; height:24px; cursor:pointer;" onchange="handleCheckboxChange(event)">
            </td>
            <td class="row-no" style="text-align: center; font-weight:bold; color:#64748b; cursor:pointer; user-select:none;"
                onmousedown="startLongPress(${i}, this)" onmouseup="cancelLongPress(this)" onmouseleave="cancelLongPress(this)"
                ontouchstart="startLongPress(${i}, this)" ontouchend="cancelLongPress(this)" ontouchcancel="cancelLongPress(this)"
                title="長按2秒清空此行">
                ${String(i).padStart(2, '0')}
            </td>
    `;
    products.forEach(p => {
        rowHtml += `
            <td>
                <input type="text" class="qty-input" inputmode="none" readonly
                       data-row="${i}" data-price="${p.price}" data-prod-id="${p.id}" 
                       onclick="setActiveInput(this)">
            </td>
        `;
    });
    
    rowHtml += `
            <td class="row-total" id="total-${i}" onclick="handleTotalClick(${i})" title="點1下收500，點2下收1000">$0</td>
            <td>
                <div style="display: flex; gap: 6px; justify-content: center;">
                    <button class="note-btn" style="width: 38px; padding: 6px; background: #e0e7ff; border-color: #c7d2fe; font-size:16px;" id="voiceBtn-${i}" onclick="startVoiceOrder(${i})" title="語音點單">🎤</button>
                    <button class="note-btn" style="width: 38px; padding: 6px; font-size:16px;" id="noteBtn-${i}" onclick="openNoteModal(${i})" title="文字備註">📝</button>
                    <input type="hidden" id="noteVal-${i}" value="">
                </div>
            </td>
        </tr>
    `;
    return rowHtml;
}

function renderTableRows(start, end) {
    const tbody = document.getElementById('dataRowsBody');
    let html = "";
    for (let i = start; i <= end; i++) { html += generateRowHTML(i); }
    if (start === 1) { tbody.innerHTML = html; } else { tbody.insertAdjacentHTML('beforeend', html); }
    closeKeypad();
}

function resetTable() {
    currentRowCount = 10;
    renderTableRows(1, currentRowCount);
    updateLiveRevenue();
}

function handleCheckboxChange(e) {
    updateLiveRevenue(); 
    const rowNum = parseInt(e.target.dataset.row);
    if (rowNum === currentRowCount && e.target.checked) {
        let newStart = currentRowCount + 1;
        currentRowCount += 5;
        renderTableRows(newStart, currentRowCount);
    }
    
    if(e.target.checked) {
        document.getElementById(`row-${rowNum}`).style.backgroundColor = 'rgba(46, 204, 113, 0.15)';
    } else {
        document.getElementById(`row-${rowNum}`).style.backgroundColor = '';
    }
}

function calculateRowTotal(rowNum) {
    const inputs = document.querySelectorAll(`input[data-row="${rowNum}"]`);
    let total = 0;
    inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        const price = parseInt(input.dataset.price) || 0;
        total += (qty * price);
    });
    document.getElementById(`total-${rowNum}`).textContent = `$${total}`;
    document.getElementById(`total-${rowNum}`).dataset.rawTotal = total;
    updateLiveRevenue(); 
}

let clickTimer = null;
function handleTotalClick(rowNum) {
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        calculateChange(rowNum, 1000);
    } else {
        clickTimer = setTimeout(() => {
            clickTimer = null;
            calculateChange(rowNum, 500);
        }, 250); 
    }
}

function calculateChange(rowNum, payAmount) {
    let rawTotal = parseInt(document.getElementById(`total-${rowNum}`).dataset.rawTotal) || 0;
    if(rawTotal === 0) return;
    
    let change = payAmount - rawTotal;
    if (change < 0) {
        showToast(`⚠️ 客人付的 $${payAmount} 不夠哦！(總額 $${rawTotal})`);
    } else {
        showToast(`💵 收 $${payAmount}，應找零：$${change}`);
        const cb = document.querySelector(`#row-${rowNum} .received-cb`);
        if(!cb.checked) {
            cb.checked = true;
            handleCheckboxChange({target: cb});
        }
    }
}

function setActiveInput(inputElement) {
    document.querySelectorAll('.qty-input').forEach(el => el.style.borderColor = '#ccc');
    activeInput = inputElement;
    activeInput.style.borderColor = '#4f46e5';
    
    const keypad = document.getElementById('virtualKeypad');
    keypad.style.display = 'block';
    setTimeout(() => { keypad.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
}

function closeKeypad() {
    document.getElementById('virtualKeypad').style.display = 'none';
    if(activeInput) {
        activeInput.style.borderColor = '#ccc';
        activeInput = null;
    }
}

function initVirtualKeypad() {
    document.querySelectorAll('.keypad-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const value = e.target.dataset.value;
            
            if (action === 'done') { closeKeypad(); return; }
            if (!activeInput) return;
            
            let currentVal = activeInput.value;
            if (action === 'clear') { activeInput.value = ''; } 
            else if (action === 'back') { activeInput.value = currentVal.slice(0, -1); } 
            else if (value) {
                if (e.target.classList.contains('keypad-btn-quick')) {
                    activeInput.value = value.replace('+', ''); 
                } else {
                    activeInput.value = currentVal + value;
                }
            }
            calculateRowTotal(activeInput.dataset.row);
        });
    });
}

function startVoiceOrder(rowNum) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("⚠️ 您的瀏覽器不支援語音輸入！請使用 Safari 或 Chrome。");
        return;
    }

    if (rowSpeechRecognition) rowSpeechRecognition.stop();

    rowSpeechRecognition = new SpeechRecognition();
    rowSpeechRecognition.lang = 'zh-TW';
    rowSpeechRecognition.interimResults = false;

    const btn = document.getElementById(`voiceBtn-${rowNum}`);
    
    rowSpeechRecognition.onstart = function() {
        btn.textContent = '🔴';
        btn.style.background = '#fecaca';
        showToast("🎤 錄音中... 請說 (例如：兩個原味三個草莓)");
    };

    rowSpeechRecognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        showToast(`🗣️ 聽到：「${transcript}」... AI 思考中 🧠`);
        parseVoiceOrderWithAI(transcript, rowNum);
    };

    rowSpeechRecognition.onerror = function() {
        showToast("⚠️ 聽不清楚，請再試一次");
    };

    rowSpeechRecognition.onend = function() {
        btn.textContent = '🎤';
        btn.style.background = '#e0e7ff';
    };

    rowSpeechRecognition.start();
}

async function parseVoiceOrderWithAI(transcript, rowNum) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/ai/parse-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: transcript })
        });
        
        const result = await res.json();
        
        if (result.status === 'success') {
            const parsedData = result.data; 

            if (parsedData.action === "clear") {
                clearSpecificRow(rowNum);
                showToast(`🧹 語音指令：第 ${rowNum} 行已清空`);
                return; 
            }

            if (parsedData.note) {
                document.getElementById(`noteVal-${rowNum}`).value = parsedData.note;
                const noteBtn = document.getElementById(`noteBtn-${rowNum}`);
                noteBtn.classList.add('has-note');
                noteBtn.textContent = '📄';
            }

            if (parsedData.is_paid === true) {
                const cb = document.querySelector(`#row-${rowNum} .received-cb`);
                if (!cb.checked) {
                    cb.checked = true;
                    handleCheckboxChange({target: cb}); 
                }
            }

            let matchCount = 0;

            for (const [prodName, qty] of Object.entries(parsedData)) {
                const prod = products.find(p => p.name === prodName);
                if (prod && qty > 0) {
                    const input = document.querySelector(`input[data-row="${rowNum}"][data-prod-id="${prod.id}"]`);
                    if (input) {
                        input.value = qty; 
                        matchCount++;
                    }
                }
            }
            
            if (matchCount > 0 || parsedData.note || parsedData.is_paid) {
                calculateRowTotal(rowNum); 
                showToast(`✨ AI 神解析完成！`);
            } else {
                showToast(`❌ AI 找不到對應的菜單，請手動輸入`);
            }
        } else {
            showToast(`❌ AI 思考失敗: ${result.message}`);
        }
    } catch (e) {
        showToast(`❌ 網路連線錯誤，無法呼叫 AI 大腦`);
    }
}

function openNoteModal(rowNum) {
    currentNoteRow = rowNum;
    document.getElementById('noteInput').value = document.getElementById(`noteVal-${rowNum}`).value;
    document.getElementById('noteModal').style.display = 'flex';
}
function closeNoteModal() { 
    document.getElementById('noteModal').style.display = 'none'; 
    currentNoteRow = null; 
    if(speechRecognition) speechRecognition.stop(); 
}

function confirmNote() {
    if (!currentNoteRow) return;
    const noteText = document.getElementById('noteInput').value.trim();
    document.getElementById(`noteVal-${currentNoteRow}`).value = noteText;
    const btn = document.getElementById(`noteBtn-${currentNoteRow}`);
    if (noteText) { btn.classList.add('has-note'); btn.textContent = '📄'; } 
    else { btn.classList.remove('has-note'); btn.textContent = '📝'; }
    closeNoteModal();
}

function toggleSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micBtn = document.getElementById('micBtn');

    if (!SpeechRecognition) { alert("⚠️ 不支援語音輸入！"); return; }
    if (!speechRecognition) {
        speechRecognition = new SpeechRecognition();
        speechRecognition.lang = 'zh-TW';
        speechRecognition.onresult = function(event) {
            const input = document.getElementById('noteInput');
            input.value = input.value + (input.value ? ' ' : '') + event.results[0][0].transcript;
            micBtn.innerHTML = '<span>🎤 語音輸入</span>'; micBtn.style.background = "";
        };
        speechRecognition.onerror = function() { showToast("⚠️ 失敗，請重試"); micBtn.innerHTML = '<span>🎤 語音輸入</span>'; micBtn.style.background = ""; };
        speechRecognition.onend = function() { micBtn.innerHTML = '<span>🎤 語音輸入</span>'; micBtn.style.background = ""; };
    }
    micBtn.innerHTML = '<span>🎙️ 聆聽中...</span>'; micBtn.style.background = "#fca5a5";
    speechRecognition.start();
}

async function submitOrders() {
    const payload = [];
    for (let i = 1; i <= currentRowCount; i++) {
        const rawTotal = parseInt(document.getElementById(`total-${i}`).dataset.rawTotal) || 0;
        if (rawTotal > 0) {
            const isReceived = document.querySelector(`#row-${i} .received-cb`).checked;
            const note = document.getElementById(`noteVal-${i}`).value;
            const orderNo = `D${new Date().getDate()}-${String(i).padStart(2,'0')}`;
            
            let itemsArr = [];
            const inputs = document.querySelectorAll(`input.qty-input[data-row="${i}"]`);
            inputs.forEach(input => {
                const qty = parseInt(input.value);
                if (qty > 0) {
                    const prodId = parseInt(input.dataset.prodId);
                    const prod = products.find(p => p.id === prodId);
                    if (prod) itemsArr.push(`${prod.name}x${qty}`);
                }
            });
            const itemsStr = itemsArr.join(', ');

            payload.push({ 
                order_no: orderNo, 
                total_amount: rawTotal, 
                received: isReceived, 
                items: itemsStr,
                note: note 
            });
        }
    }

    if (payload.length === 0) { alert("⚠️ 表格中沒有任何金額大於 0 的訂單喔！"); return; }

    const btn = document.getElementById('checkoutBtn');
    const originalText = document.getElementById('checkoutButtonText').textContent;
    btn.disabled = true;
    document.getElementById('checkoutButtonText').textContent = "📡 傳送至總部中...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert(`🎉 結帳成功！共送出 ${payload.length} 筆訂單！`);
            resetTable();    
            fetchTodayStats();    
        } else { alert("❌ 結帳失敗：" + result.message); }
    } catch (e) { alert("❌ 網路連線錯誤，請檢查您的網路或重新整理！"); } 
    finally { btn.disabled = false; document.getElementById('checkoutButtonText').textContent = originalText; }
}

function toggleCalculator() {
    const calc = document.getElementById('calculatorContainer');
    calc.style.display = calc.style.display === 'none' ? 'block' : 'none';
}

// 🌟 大師優化：防禦型 eval
function calcAction(val) {
    const display = document.getElementById('calcDisplay');
    if (val === 'C') { display.value = ''; } 
    else if (val === '=') { 
        try { 
            // 防護機制：只允許執行數字與數學符號，避免 XSS 惡意指令
            if (/^[\d+\-*/.]+$/.test(display.value)) {
                display.value = eval(display.value); 
            } else {
                display.value = 'Error';
            }
        } catch(e) { display.value = 'Error'; } 
    } 
    else { display.value += val; }
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeBtn').textContent = isDark ? '[ 深色模式 ]' : '[ 淺色模式 ]';
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
}
