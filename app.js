document.addEventListener('DOMContentLoaded', () => {
    // ---- STATE MANAGEMENT ----
    let state = {
        dailyData: {} // Keyed by 'YYYY-MM-DD'
    };

    const getToday = () => new Date().toISOString().split('T')[0];

    const ensureTodayData = () => {
        const today = getToday();
        if (!state.dailyData[today]) {
            state.dailyData[today] = {
                sales: 0,
                bills: [],
                dealerPayments: [],
                inventory: []
            };
        }
        return state.dailyData[today];
    };

    // ---- STORAGE ----
    const saveState = () => localStorage.setItem('restoDashState', JSON.stringify(state));
    const loadState = () => {
        const savedState = localStorage.getItem('restoDashState');
        if (savedState) {
            state = JSON.parse(savedState);
        }
    };

    // ---- UI SELECTORS ----
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // ---- UI RENDERING & UPDATES ----
    const updateDailyStatement = () => {
        const todayData = ensureTodayData();
        const totalSales = todayData.sales;
        const totalDealer = todayData.dealerPayments.reduce((sum, p) => sum + p.amount, 0);

        $('#statementDate').textContent = new Date().toLocaleDateString();
        $('#summarySales').textContent = `Rs. ${totalSales.toLocaleString()}`;
        $('#summaryDealer').textContent = `Rs. ${totalDealer.toLocaleString()}`;
        $('#summaryNet').textContent = `Rs. ${(totalSales - totalDealer).toLocaleString()}`;
        
        const inventorySummaryEl = $('#summaryInventory');
        inventorySummaryEl.innerHTML = '';
        if (todayData.inventory.length > 0) {
            todayData.inventory.forEach(item => {
                inventorySummaryEl.innerHTML += `<p><strong>${item.name}:</strong> Used ${item.opening + item.purchased - item.wastage} units.</p>`;
            });
        } else {
            inventorySummaryEl.innerHTML = '<p>No inventory data for today.</p>';
        }
    };

    const renderLists = () => {
        const todayData = ensureTodayData();
        // Render Dealer List
        $('#dealerList').innerHTML = todayData.dealerPayments.map(p => `<li><strong>${p.name}:</strong> Rs. ${p.amount.toLocaleString()}</li>`).join('');
        // Render Inventory List
        $('#inventoryList').innerHTML = todayData.inventory.map(item => `<div><strong>${item.name}</strong> (O: ${item.opening}, P: ${item.purchased}, W: ${item.wastage})</div>`).join('');
    };

    // ---- EVENT LISTENERS ----
    // Navigation
    $$('.sidebar nav button').forEach(button => {
        button.addEventListener('click', () => {
            $$('.sidebar nav button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            $$('.section').forEach(sec => sec.classList.remove('active'));
            $(`#${button.dataset.section}`).classList.add('active');
        });
    });
    
    // Sales & Billing
    let currentBillItems = [];
    let currentBillTotal = 0;

    $('#addItemBtn').addEventListener('click', () => {
        const name = $('#itemName').value;
        const qty = parseInt($('#itemQty').value);
        const price = parseFloat($('#itemPrice').value);
        if (!name || !qty || !price) return alert('Please fill all bill item fields.');

        const total = qty * price;
        currentBillItems.push({ name, qty, price, total });
        currentBillTotal += total;

        $('#billTable').innerHTML += `<tr><td>${name}</td><td>${qty}</td><td>${price}</td><td>${total}</td></tr>`;
        $('#billTotal').textContent = currentBillTotal.toLocaleString();
        $('#itemName').value = '';
        $('#itemQty').value = '';
        $('#itemPrice').value = '';
    });
    
    $('#saveBillBtn').addEventListener('click', () => {
        if (currentBillItems.length === 0) return alert('No items in the current bill.');
        
        const todayData = ensureTodayData();
        todayData.sales += currentBillTotal;
        todayData.bills.push({ id: Date.now(), items: currentBillItems, total: currentBillTotal });
        
        currentBillItems = [];
        currentBillTotal = 0;
        $('#billTable').innerHTML = '';
        $('#billTotal').textContent = '0';
        
        saveState();
        updateDailyStatement();
        alert('Bill saved and sales updated!');
    });

    // Inventory
    $('#addInventoryBtn').addEventListener('click', () => {
        const name = $('#invItemName').value;
        const opening = parseFloat($('#invOpening').value) || 0;
        const purchased = parseFloat($('#invPurchased').value) || 0;
        const wastage = parseFloat($('#invWastage').value) || 0;
        if (!name) return alert('Please enter an inventory item name.');
        
        ensureTodayData().inventory.push({ name, opening, purchased, wastage });
        
        $('#invItemName').value = '';
        $('#invOpening').value = '';
        $('#invPurchased').value = '';
        $('#invWastage').value = '';

        saveState();
        renderLists();
        updateDailyStatement();
    });

    // Dealer Payments
    $('#addDealerBtn').addEventListener('click', () => {
        const name = $('#dealerName').value;
        const amount = parseFloat($('#dealerAmount').value);
        if (!name || !amount) return alert('Please enter dealer name and amount.');
        
        ensureTodayData().dealerPayments.push({ name, amount });

        $('#dealerName').value = '';
        $('#dealerAmount').value = '';
        
        saveState();
        renderLists();
        updateDailyStatement();
    });

    // Data Management
    $('#clearDataBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
            localStorage.removeItem('restoDashState');
            location.reload();
        }
    });

    // ---- PDF GENERATION ----
    const generatePdf = async (elementId, filename) => {
        const element = document.getElementById(elementId);
        const canvas = await html2canvas(element);
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(filename);
    };

    $('#downloadStatementBtn').addEventListener('click', () => {
        const todayData = ensureTodayData();
        // Populate PDF template
        $('#pdfStatementDate').textContent = new Date().toLocaleDateString();
        $('#pdfSales').textContent = `Rs. ${todayData.sales.toLocaleString()}`;
        const totalDealer = todayData.dealerPayments.reduce((sum, p) => sum + p.amount, 0);
        $('#pdfDealer').textContent = `Rs. ${totalDealer.toLocaleString()}`;
        $('#pdfNet').textContent = `Rs. ${(todayData.sales - totalDealer).toLocaleString()}`;
        
        $('#pdfInventory').innerHTML = todayData.inventory.map(item => `<div class="pdf-item"><span>${item.name} Used:</span><span>${item.opening + item.purchased - item.wastage} units</span></div>`).join('');
        
        generatePdf('statementPdfTemplate', `Daily_Statement_${getToday()}.pdf`);
    });

    $('#downloadBillBtn').addEventListener('click', () => {
        // For simplicity, this downloads the last SAVED bill of the day
        const lastBill = ensureTodayData().bills.slice(-1)[0];
        if (!lastBill) return alert('No saved bill to download. Save a bill first.');
        
        // This is a simplified luxury bill design.
        const billTemplate = $('#billPdfTemplate');
        billTemplate.style.width = '800px';
        billTemplate.style.padding = '40px';
        billTemplate.style.background = 'black';
        billTemplate.style.color = 'gold';
        billTemplate.style.border = '8px solid gold';
        billTemplate.innerHTML = `
            <h1 style="color: gold; text-align: center;">INVOICE</h1>
            <p style="text-align: center;">Date: ${new Date().toLocaleString()}</p>
            <hr style="border-color: gold;">
            <table style="width: 100%; color: white; margin-top: 20px;">
                ${lastBill.items.map(i => `<tr><td>${i.name}</td><td>${i.qty} x ${i.price}</td><td>Rs. ${i.total}</td></tr>`).join('')}
            </table>
            <hr style="border-color: gold;">
            <h2 style="text-align: right; color: gold; margin-top: 20px;">Total: Rs. ${lastBill.total.toLocaleString()}</h2>
        `;
        generatePdf('billPdfTemplate', `Bill_${lastBill.id}.pdf`);
    });

    // ---- INITIALIZE APP ----
    loadState();
    ensureTodayData();
    renderLists();
    updateDailyStatement();
    setInterval(()=> $('#liveClock').textContent = new Date().toLocaleTimeString(), 1000);
});