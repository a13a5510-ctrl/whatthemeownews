const GAPI_CLIENT_ID = '324921111026-48g0ohodrjb8qntl2lbpcjamt9vdb9qj.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCeW2JaypxuvYGsvd-bO-ntktjCvbMpCr8';
const SPREADSHEET_ID = '1fP1LY94i_Vp37UXSqwOA4Ih83GmBMDzd3YlMHZi_0kE'; 
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'; 

const TOTAL_DATA_ROWS = 30;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']; 

const DOM = {
    dataRowsBody: document.getElementById('dataRowsBody'),
    pageInfo: document.getElementById('pageInfo'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    dateDisplay: document.getElementById('dateDisplay'),
    headerRow: document.getElementById('headerRow'),
    saveToDriveBtn: document.getElementById('saveToDriveBtn'),
    authStatus: document.getElementById('authStatus'),
    saveButtonText: document.getElementById('saveButtonText'),
    keypad: document.getElementById('virtualKeypad'),
    tableContainer: document.querySelector('.table-container'),
    calculatorContainer: document.getElementById('calculatorContainer'),
    calcDisplay: document.getElementById('calcDisplay'),
    dashCount: document.getElementById('dashCount'),
    dashTotal: document.getElementById('dashTotal'),
    noteModal: document.getElementById('noteModal'),
    noteInput: document.getElementById('noteInput'),
    micBtn: document.getElementById('micBtn'),
    fullScreenBtn: document.getElementById('fullScreenBtn'),
    alarmModal: document.getElementById('alarmModal'),
    alarmDetails: document.getElementById('alarmDetails'),
    themeBtn: document.getElementById('themeBtn'),
    themeMeta: document.getElementById('theme-color-meta')
};

let allOrderData = []; 
let currentPageIndex = 0; 
let unitPrices = []; 
let accessToken = null; 
let tokenClient = null; 
let currentTargetCell = null; 
let longPressTimer = null; 
let remoteTotal = 0;
let remoteCount = 0;
let recognition = null;
let isListening = false;
let currentEditingRowIndex = null; 

// --- LocalStorage 斷電保護機制 ---
function saveToLocal() {
    localStorage.setItem('posData', JSON.stringify(allOrderData));
}

function loadFromLocal() {
    const savedData = localStorage.getItem('posData');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allOrderData = parsed;
                console.log("已從 LocalStorage 恢復資料");
                return true;
            }
        } catch (e) {
            console.error("讀取存檔失敗", e);
        }
    }
    return false;
}

function clearLocal() {
    localStorage.removeItem('posData');
}

function updateRowTimestamp(rowIndex) {
    if (!allOrderData[currentPageIndex][rowIndex].timestamp) {
        allOrderData[currentPageIndex][rowIndex].timestamp = new Date().toISOString();
        saveToLocal();
    }
}

// --- 深色模式邏輯 ---
window.toggleTheme = function() {
    const currentTheme = document.body.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        document.body.removeAttribute('data-theme');
        DOM.themeBtn.textContent = '[ 深色模式 ]';
        if(DOM.themeMeta) DOM.themeMeta.setAttribute("content", "#3f51b5");
    } else {
        document.body.setAttribute('data-theme', 'dark');
        DOM.themeBtn.textContent = '[ 淺色模式 ]';
        if(DOM.themeMeta) DOM.themeMeta.setAttribute("content", "#121212");
    }
};

// --- 聲音警報邏輯 ---
let audioCtx;
let alarmInterval = null;

function unlockAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}
document.addEventListener('click', unlockAudio);

function startAlarmSound() {
    if (!audioCtx) unlockAudio();
    if (alarmInterval) return;
    playBeepPattern();
    alarmInterval = setInterval(() => {
        playBeepPattern();
    }, 1500);
}

function playBeepPattern() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'square'; 
    osc.frequency.setValueAtTime(880, now); 

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    gain.gain.setValueAtTime(0.1, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    gain.gain.setValueAtTime(0.1, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.6);
}

window.stopAlarm = function() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    DOM.alarmModal.style.display = 'none';
};

// --- 提醒系統邏輯 ---
function initReminderSystem() {
    setInterval(checkReminders, 30000); 
}

function checkReminders() {
    if (!allOrderData[currentPageIndex]) return;
    const now = new Date();
    if (DOM.alarmModal.style.display === 'flex') return;

    let triggeredRowIndex = -1;
    let triggeredNote = "";
    let triggeredId = "";

    for (let i = 0; i < allOrderData[currentPageIndex].length; i++) {
        const rowData = allOrderData[currentPageIndex][i];
        if (!rowData.note || rowData.alerted) continue; 

        const timeMatch = rowData.note.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
        
        if (timeMatch) {
            const hour = parseInt(timeMatch[1]);
            const minute = parseInt(timeMatch[2]);
            const targetTime = new Date();
            targetTime.setHours(hour, minute, 0, 0);
            const diff = targetTime - now;
            const tenMinutesInMs = 10 * 60 * 1000;

            if (diff > 0 && diff <= tenMinutesInMs) {
                triggeredRowIndex = i;
                triggeredId = (i + 1).toString();
                triggeredNote = rowData.note;
                break; 
            }
        }
    }

    if (triggeredRowIndex !== -1) {
        DOM.alarmDetails.textContent = `編號 ${triggeredId}：${triggeredNote}`;
        DOM.alarmModal.style.display = 'flex';
        startAlarmSound();
        allOrderData[currentPageIndex][triggeredRowIndex].alerted = true;
    }
}

// --- 介面功能邏輯 ---
window.toggleFullScreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`全螢幕無法啟用 (PWA模式下通常已是全螢幕): ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

document.addEventListener('fullscreenchange', () => {
    const btn = DOM.fullScreenBtn;
    if (document.fullscreenElement) {
        btn.textContent = '[ 結束全螢幕 ]';
        btn.classList.add('active');
    } else {
        btn.textContent = '[ 全螢幕 ]';
        btn.classList.remove('active');
    }
});

window.toggleCalculator = function() {
    DOM.calculatorContainer.style.display = (DOM.calculatorContainer.style.display === 'block') ? 'none' : 'block';
};
window.calcAction = function(val) {
    const display = DOM.calcDisplay;
    if (val === 'C') { display.value = ''; } 
    else if (val === '=') {
        try {
            let expr = display.value.replace(/×/g, '*').replace(/÷/g, '/');
            if (expr) display.value = eval(expr); 
        } catch (e) { display.value = 'Error'; }
    } else {
        const lastChar = display.value.slice(-1);
        const ops = ['+', '-', '*', '/'];
        if (ops.includes(val) && ops.includes(lastChar)) {
            display.value = display.value.slice(0, -1) + val;
        } else {
            display.value += val;
        }
    }
};

// --- 語音備註 ---
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-TW'; 
        recognition.continuous = false; 
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            DOM.noteInput.value += (DOM.noteInput.value ? ' ' : '') + transcript;
            stopSpeech(); 
        };
        recognition.onerror = (event) => { stopSpeech(); alert("語音識別發生錯誤或未授權麥克風。"); };
        recognition.onend = () => { stopSpeech(); };
    } else {
        DOM.micBtn.style.display = 'none'; 
    }
}

window.toggleSpeech = function() {
    if (!recognition) { alert("您的瀏覽器不支援語音識別功能。"); return; }
    if (isListening) stopSpeech(); else startSpeech();
};

function startSpeech() {
    try {
        recognition.start();
        isListening = true;
        DOM.micBtn.classList.add('listening');
        DOM.micBtn.innerHTML = '<span>🔴 正在聆聽...</span>';
    } catch (e) { console.error(e); }
}

function stopSpeech() {
    if (recognition) recognition.stop();
    isListening = false;
    DOM.micBtn.classList.remove('listening');
    DOM.micBtn.innerHTML = '<span>🎤 語音輸入</span>';
}

function openNoteModal(rowIndex) {
    currentEditingRowIndex = rowIndex;
    const currentNote = allOrderData[currentPageIndex][rowIndex].note || "";
    DOM.noteInput.value = currentNote;
    DOM.noteModal.style.display = 'flex';
    setTimeout(() => DOM.noteInput.focus(), 100);
}

window.closeNoteModal = function() {
    stopSpeech();
    DOM.noteModal.style.display = 'none';
    currentEditingRowIndex = null;
};

window.confirmNote = function() {
    if (currentEditingRowIndex !== null) {
        const newNote = DOM.noteInput.value.trim();
        allOrderData[currentPageIndex][currentEditingRowIndex].note = newNote;
        allOrderData[currentPageIndex][currentEditingRowIndex].alerted = false;
        updateRowTimestamp(currentEditingRowIndex); 
        saveToLocal(); 
        renderPage(allOrderData[currentPageIndex]); 
    }
    closeNoteModal();
};

// --- Google API 邏輯 ---
function handleTokenResponse(response) {
    if (response && response.access_token) {
        accessToken = response.access_token;
        gapi.client.setToken({ access_token: accessToken });
        DOM.saveToDriveBtn.disabled = false;
        DOM.saveButtonText.textContent = '💾 儲存至 Google Sheets';
        DOM.authStatus.textContent = '✅ 已登入';
        updateDashboardFromSheet();
        if (DOM.saveButtonText.textContent.includes('正在授權') || DOM.saveButtonText.textContent.includes('呼叫登入')) {
            saveAndAppendToSheet(); 
        }
    } else {
        accessToken = null;
        DOM.saveToDriveBtn.disabled = false;
        DOM.saveButtonText.textContent = 'Google 登入並儲存';
    }
}

function initGIS() {
    if (typeof google === 'undefined' || !google.accounts) {
         setTimeout(initGIS, 500); return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GAPI_CLIENT_ID, scope: SCOPES, callback: handleTokenResponse, prompt: '', 
    });
}

function initClient() {
    gapi.client.init({
        apiKey: API_KEY, discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"]
    }).then(() => {
        DOM.authStatus.textContent = '📢 服務載入完成';
        DOM.saveToDriveBtn.disabled = false;
    }, (error) => {
        DOM.authStatus.textContent = `API 載入失敗`;
    });
}

function handleAuthClick() {
    if (!tokenClient && !accessToken) { initGIS(); return; }
    if (accessToken) { saveAndAppendToSheet(); } 
    else if (tokenClient) {
        DOM.saveButtonText.textContent = '⚙️ 呼叫登入...';
        tokenClient.requestAccessToken();
    }
}

function getHeaders() {
    const headerCells = DOM.headerRow.querySelectorAll('th');
    const productHeaders = [];
    for (let i = 2; i < headerCells.length - 2; i++) {
        const text = headerCells[i].textContent.replace(/\n/g, '').replace(/\s+/g, '');
        const productName = text.replace(/\(\d+\)/g, '').trim();
        productHeaders.push(productName);
    }
    return ["日期", "時間", "頁面", "已收", "編號", ...productHeaders, "總價格", "備註"];
}

async function ensureTodaySheetExists(sheetName) {
    const response = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheets = response.result.sheets;
    if (!sheets.some(s => s.properties.title === sheetName)) {
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
        });
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED', resource: { values: [getHeaders()] }
        });
    }
}

async function getSheetData(sheetName) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A:Z`
        });
        return response.result.values || [];
    } catch (e) { return []; }
}

async function updateDashboardFromSheet() {
    if (!accessToken) return;
    const now = new Date();
    const sheetName = `${now.getMonth() + 1}/${now.getDate()}`;
    const data = await getSheetData(sheetName);
    
    remoteCount = 0;
    remoteTotal = 0;

    if (data.length > 1) {
        const priceIndex = data[0].length - 2; 
        data.slice(1).forEach(row => {
            remoteCount++;
            if (row[priceIndex]) {
                const price = parseInt(row[priceIndex]) || 0;
                remoteTotal += price;
            }
        });
    }
    renderRealTimeDashboard();
}

function renderRealTimeDashboard() {
    let localCount = 0;
    let localTotal = 0;

    if (allOrderData[currentPageIndex]) {
        allOrderData[currentPageIndex].forEach(row => {
            if (row.received && row.totalPrice > 0) {
                localCount++;
                localTotal += row.totalPrice;
            }
        });
    }

    DOM.dashCount.textContent = remoteCount + localCount;
    DOM.dashTotal.textContent = `$${(remoteTotal + localTotal).toLocaleString()}`;
}

async function saveAndAppendToSheet() {
    DOM.saveButtonText.textContent = '⚙️ 處理中...';
    DOM.saveToDriveBtn.disabled = true;
    DOM.saveToDriveBtn.style.opacity = '0.7'; 
    
    try {
        const dataForSheet = formatDataForSheet();
        if (!dataForSheet) throw new Error("無資料");

        const now = new Date();
        const sheetName = `${now.getMonth() + 1}/${now.getDate()}`;
        await ensureTodaySheetExists(sheetName);

        const sheetData = await getSheetData(sheetName);
        const idIndex = 4; 
        
        const idToRowMap = new Map();
        sheetData.forEach((row, index) => {
            if (index > 0 && row[idIndex]) {
                idToRowMap.set(row[idIndex], index + 1);
            }
        });

        const rowsToAppend = [];
        const rowsToUpdate = [];
        let conflictAction = null; 

        for (let newRow of dataForSheet) {
            const newId = newRow[4];
            const existingRowIndex = idToRowMap.get(newId);

            if (existingRowIndex) {
                if (!conflictAction) {
                    if (confirm(`⚠️ 編號「${newId}」已存在！\n要【累加】數量嗎？\n\n[確定] = 累加\n[取消] = 覆蓋`)) {
                        conflictAction = 'accumulate';
                    } else {
                        conflictAction = 'overwrite';
                    }
                }

                if (conflictAction === 'overwrite') {
                    rowsToUpdate.push({
                        range: `${sheetName}!A${existingRowIndex}`,
                        values: [newRow]
                    });
                } else if (conflictAction === 'accumulate') {
                    const oldRow = sheetData[existingRowIndex - 1];
                    const mergedRow = [...newRow]; 
                    let newTotal = 0;
                    for (let i = 5; i < newRow.length - 2; i++) {
                        const oldQty = parseInt(oldRow[i]) || 0;
                        const newQty = parseInt(newRow[i]) || 0;
                        const sum = oldQty + newQty;
                        mergedRow[i] = sum;
                        newTotal += sum * unitPrices[i - 5];
                    }
                    mergedRow[mergedRow.length - 2] = newTotal;
                    rowsToUpdate.push({
                        range: `${sheetName}!A${existingRowIndex}`,
                        values: [mergedRow]
                    });
                }
            } else {
                rowsToAppend.push(newRow);
            }
        }

        if (rowsToUpdate.length > 0) {
            const data = rowsToUpdate.map(item => ({
                range: item.range,
                values: item.values
            }));
            await gapi.client.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: { valueInputOption: 'USER_ENTERED', data: data }
            });
        }

        if (rowsToAppend.length > 0) {
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
                resource: { values: rowsToAppend }
            });
        }

        allOrderData[currentPageIndex].forEach((row, index) => {
            const hasData = row.quantities.some(q => q > 0);
            if (row.received || hasData) {
                if (row.received) {
                    clearRow(index, false); 
                }
            }
        });
        renderPage(allOrderData[currentPageIndex]); 
        
        clearLocal();

        const totalProcessed = rowsToUpdate.length + rowsToAppend.length;
        alert(`✅ 處理完成！\n共處理 ${totalProcessed} 筆資料。`);
        DOM.authStatus.textContent = `✅ 成功處理 ${totalProcessed} 筆資料。`;
        
        updateDashboardFromSheet();

    } catch (error) {
        if (error.message === "無資料") return;
        console.error(error);
        alert("儲存失敗，請查看 Console。");
    } finally {
        DOM.saveButtonText.textContent = '💾 儲存至 Google Sheets';
        DOM.saveToDriveBtn.disabled = false;
        DOM.saveToDriveBtn.style.opacity = '1';
    }
}

function formatDataForSheet() {
    const headerCells = DOM.headerRow.querySelectorAll('th');
    const productHeaders = [];
    for (let i = 2; i < headerCells.length - 2; i++) {
        const text = headerCells[i].textContent.replace(/\n/g, '').replace(/\s+/g, '');
        productHeaders.push(text.replace(/\(\d+\)/g, '').trim());
    }
    
    const outputRows = []; 
    
    allOrderData.forEach((pageData, pageIndex) => {
        const pageNumber = pageIndex + 1;
        pageData.forEach((rowData, rowIndex) => {
            const hasQuantity = rowData.quantities.some(q => q > 0);
            if (rowData.received || hasQuantity) {
                let recordTime;
                if (rowData.timestamp) {
                    recordTime = new Date(rowData.timestamp); 
                } else {
                    recordTime = new Date(); 
                }

                const dateString = recordTime.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
                const timeString = recordTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                const rowNumber = (rowIndex + 1).toString();
                const receivedStatus = rowData.received ? "是" : "否";
                const safeQuantities = rowData.quantities.map(q => q || 0);
                const note = rowData.note || "";
                
                const row = [
                    dateString, timeString, pageNumber, receivedStatus, rowNumber,
                    ...safeQuantities, rowData.totalPrice, note
                ];
                outputRows.push(row);
            }
        });
    });
    
    if (outputRows.length === 0) {
        alert("沒有發現任何有效資料！");
        return null;
    }
    return outputRows; 
}

// --- 輔助 & 事件 ---
function initializeDate() { 
    const today = new Date(); 
    const monthYear = `${today.getFullYear()}年${today.getMonth() + 1}月`;
    const weekdayText = `星期${WEEKDAYS[today.getDay()]}`;
    DOM.dateDisplay.innerHTML = `<div class="calendar-header">${monthYear} (${weekdayText})</div><div class="calendar-day"><span class="calendar-day-number">${today.getDate()}</span>日</div>`;
}

function fetchUnitPrices() { 
    const thElements = DOM.headerRow.getElementsByTagName('th');
    for (let i = 2; i < thElements.length - 2; i++) {
        const match = thElements[i].textContent.match(/\((\d+)\)/);
        unitPrices.push(match && match[1] ? parseInt(match[1]) : 0);
    }
}

function createEmptyPage() {
    const newPage = [];
    for (let i = 0; i < TOTAL_DATA_ROWS; i++) {
        newPage.push({ received: false, quantities: Array(11).fill(0), totalPrice: 0, note: "", alerted: false, timestamp: null });
    }
    return newPage;
}

function calculateRowTotal(rowIndex) {
    const row = DOM.dataRowsBody.rows[rowIndex];
    if (!row) return;
    let total = 0;
    const quantities = [];
    for (let i = 2; i <= 12; i++) {
        const quantityCell = row.cells[i].querySelector('.quantity-cell');
        const value = quantityCell.getAttribute('data-value') || ''; 
        const quantity = parseInt(value || 0); 
        total += quantity * unitPrices[i - 2];
        quantities.push(quantity);
    }
    allOrderData[currentPageIndex][rowIndex].quantities = quantities;
    allOrderData[currentPageIndex][rowIndex].totalPrice = total;
    row.cells[13].textContent = `$${total}`;
    
    if (quantities.some(q => q > 0)) {
        row.classList.add('active-row');
    } else {
        row.classList.remove('active-row');
    }
    
    updateRowTimestamp(rowIndex); 
    saveToLocal(); 
    renderRealTimeDashboard();
}

function renderPage(data) {
    DOM.dataRowsBody.innerHTML = ''; 
    data.forEach((rowData, i) => {
        let row = DOM.dataRowsBody.insertRow();
        if (rowData.quantities.some(q => q > 0)) row.classList.add('active-row');

        let receivedCell = row.insertCell();
        receivedCell.className = 'received-cell';
        const receivedCheckDiv = document.createElement('div');
        receivedCheckDiv.className = 'custom-check';
        if (rowData.received) {
            receivedCheckDiv.classList.add('checked');
            receivedCheckDiv.textContent = '\u2713'; 
        }
        receivedCell.appendChild(receivedCheckDiv); 
        
        let idCell = row.insertCell();
        idCell.textContent = i + 1; 
        idCell.className = 'id-cell';
        idCell.addEventListener('touchstart', () => startLongPress(i));
        idCell.addEventListener('touchend', cancelLongPress);
        idCell.addEventListener('mousedown', () => startLongPress(i));
        idCell.addEventListener('mouseup', cancelLongPress);
        idCell.addEventListener('mouseleave', cancelLongPress);

        rowData.quantities.forEach((quantity, j) => { 
            let cell = row.insertCell();
            const quantityDiv = document.createElement('div');
            quantityDiv.className = 'quantity-cell';
            quantityDiv.setAttribute('data-row-index', i);
            if (quantity > 0) {
                quantityDiv.setAttribute('data-value', quantity);
                quantityDiv.textContent = quantity;
                quantityDiv.classList.add('active'); 
            }
            
            quantityDiv.addEventListener('click', function(e) {
                if (this.querySelector('.flavor-hint')) return;
                const headerTh = DOM.headerRow.cells[cell.cellIndex];
                if (headerTh) {
                    const rawText = headerTh.textContent.replace(/\n/g, '').replace(/\s+/g, '');
                    const flavorName = rawText.split('(')[0].trim();
                    const hint = document.createElement('div');
                    hint.className = 'flavor-hint';
                    hint.textContent = flavorName;
                    this.appendChild(hint);
                    setTimeout(() => { if (hint.parentNode) hint.remove(); }, 2000);
                }
            });

            cell.appendChild(quantityDiv);
        });
        
        let priceCell = row.insertCell();
        priceCell.textContent = `$${rowData.totalPrice}`;
        priceCell.className = 'price-cell';
        
        priceCell.onclick = (e) => {
            e.stopPropagation(); 
            const originalPrice = rowData.totalPrice;
            if (originalPrice === 0) return; 

            const now = Date.now();
            if (priceCell.lastClickTime && (now - priceCell.lastClickTime < 300)) {
                const change = 1000 - originalPrice;
                priceCell.textContent = `找$${change}`;
                priceCell.className = 'price-cell change-1000'; 
                priceCell.lastClickTime = 0; 
            } else {
                const change = 500 - originalPrice;
                priceCell.textContent = `找$${change}`;
                priceCell.className = 'price-cell change-500'; 
                priceCell.lastClickTime = now;
            }

            if (priceCell.revertTimer) clearTimeout(priceCell.revertTimer);
            priceCell.revertTimer = setTimeout(() => {
                priceCell.textContent = `$${originalPrice}`;
                priceCell.className = 'price-cell'; 
            }, 5000);
        };

        let noteCell = row.insertCell();
        noteCell.className = 'note-cell';
        if (rowData.note) noteCell.classList.add('has-note');
        noteCell.innerHTML = '<span class="note-icon">📝</span>';
        noteCell.onclick = () => openNoteModal(i);
    });
    updatePaginationUI();
    renderRealTimeDashboard();
}

function startLongPress(rowIndex) {
    longPressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50); 
        if (confirm(`確定要清空編號「${rowIndex + 1}」的所有資料嗎？`)) {
            clearRow(rowIndex);
        }
    }, 800); 
}
function cancelLongPress() { clearTimeout(longPressTimer); }

function clearRow(rowIndex, redraw = true) {
    const rowData = allOrderData[currentPageIndex][rowIndex];
    rowData.quantities.fill(0);
    rowData.totalPrice = 0;
    rowData.received = false;
    rowData.note = "";
    rowData.alerted = false; 
    rowData.timestamp = null; 
    saveToLocal(); 
    if(redraw) renderPage(allOrderData[currentPageIndex]);
}

function updatePaginationUI() {
    const totalPages = allOrderData.length;
    const pageNumber = currentPageIndex + 1;
    DOM.pageInfo.textContent = `${pageNumber} / ${totalPages}`;
    DOM.prevPageBtn.disabled = currentPageIndex === 0;
    
    const hasData = allOrderData[currentPageIndex].some(r => r.received || r.quantities.some(q => q > 0));
    DOM.nextPageBtn.disabled = (pageNumber === totalPages && !hasData);
}

function handleKeypadInput(button) {
    if (!currentTargetCell) return;
    const value = button.getAttribute('data-value');
    const action = button.getAttribute('data-action');
    const rowIndex = parseInt(currentTargetCell.getAttribute('data-row-index'));
    
    if (value) {
        let currentText = currentTargetCell.getAttribute('data-value') || '';
        if (button.classList.contains('keypad-btn-quick')) {
            currentText = value; 
        } else {
            if (currentText === '0') currentText = value;
            else currentText += value;
        }
        currentTargetCell.setAttribute('data-value', currentText);
        currentTargetCell.textContent = currentText;
    } else if (action === 'clear') {
        currentTargetCell.setAttribute('data-value', '');
        currentTargetCell.textContent = ''; 
    } else if (action === 'back') {
        let currentText = currentTargetCell.getAttribute('data-value') || '';
        currentText = currentText.slice(0, -1);
        currentTargetCell.setAttribute('data-value', currentText);
        currentTargetCell.textContent = currentText;
    }

    const currentVal = currentTargetCell.getAttribute('data-value');
    if (currentVal && parseInt(currentVal) > 0) {
        currentTargetCell.classList.add('active');
    } else {
        currentTargetCell.classList.remove('active');
    }
    calculateRowTotal(rowIndex);
}

function handleReceivedClick(event) {
    if (!event.target.classList.contains('custom-check')) return;
    const checkDiv = event.target;
    const row = checkDiv.closest('tr');
    const rowIndex = Array.from(DOM.dataRowsBody.rows).indexOf(row);
    
    const newState = !checkDiv.classList.contains('checked');
    allOrderData[currentPageIndex][rowIndex].received = newState;
    checkDiv.classList.toggle('checked');
    checkDiv.textContent = newState ? '\u2713' : ''; 
    
    updateRowTimestamp(rowIndex); 
    saveToLocal();
    
    updatePaginationUI(); 
    renderRealTimeDashboard();
}

function handleNextPageClick() {
    if (currentPageIndex < allOrderData.length - 1) {
        currentPageIndex++;
    } else if (allOrderData[currentPageIndex].some(r => r.quantities.some(q=>q>0))) {
        allOrderData.push(createEmptyPage());
        currentPageIndex++;
    } else return;
    renderPage(allOrderData[currentPageIndex]);
}

function handlePrevPageClick() {
    if (currentPageIndex > 0) {
        currentPageIndex--;
        renderPage(allOrderData[currentPageIndex]);
    }
}

function bindEventListeners() {
    DOM.prevPageBtn.addEventListener('click', handlePrevPageClick);
    DOM.nextPageBtn.addEventListener('click', handleNextPageClick);
    if (DOM.saveToDriveBtn) DOM.saveToDriveBtn.addEventListener('click', handleAuthClick);
    DOM.dataRowsBody.addEventListener('click', handleReceivedClick);
    
    DOM.dataRowsBody.addEventListener('click', function(event) {
        if (event.target.classList.contains('quantity-cell')) {
            if (currentTargetCell) currentTargetCell.classList.remove('active');
            currentTargetCell = event.target;
            currentTargetCell.classList.add('active'); 
            
            const rect = currentTargetCell.getBoundingClientRect();
            const containerRect = DOM.tableContainer.getBoundingClientRect();
            let topPos = rect.top - containerRect.top + currentTargetCell.offsetHeight + 5; 
            let leftPos = rect.left - containerRect.left;
            
            if (leftPos + 240 > DOM.tableContainer.clientWidth) leftPos = DOM.tableContainer.clientWidth - 245;
            if (leftPos < 0) leftPos = 5;
            
            DOM.keypad.style.top = `${topPos}px`;
            DOM.keypad.style.left = `${leftPos}px`;
            DOM.keypad.style.display = 'block'; 
        }
    });
    
    DOM.keypad.addEventListener('click', function(event) {
        const button = event.target.closest('.keypad-button');
        if (button) handleKeypadInput(button);
    });
    
    document.addEventListener('click', function(event) {
        if (!DOM.keypad.contains(event.target) && !event.target.classList.contains('quantity-cell')) {
            DOM.keypad.style.display = 'none';
            if (currentTargetCell) {
                currentTargetCell.classList.remove('active');
                currentTargetCell = null;
            }
        }
    });
}

function initializeApp() {
    fetchUnitPrices();
    initializeDate(); 
    
    if (!loadFromLocal()) {
        allOrderData.push(createEmptyPage());
    }
    
    renderPage(allOrderData[currentPageIndex]);
    bindEventListeners();
    initSpeechRecognition(); 
    initReminderSystem(); 
    gapi.load('client', initClient);
    document.addEventListener('DOMContentLoaded', () => initGIS());
}

initializeApp();