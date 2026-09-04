

// StockBill Pro - Core Application Script
document.addEventListener("DOMContentLoaded", () => {
  // --- APPLICATION STATE ---
  let products = [];
  let customers = [];
  let invoices = [];
  let billingCart = []; // Current draft invoice items
  
  // Theme state
  let currentTheme = localStorage.getItem("theme") || "dark";

  // --- INITIALIZATION ---
  function init() {
    // Load from localStorage or fallback to bootstrap mock data
    if (localStorage.getItem("products")) {
      products = JSON.parse(localStorage.getItem("products"));
    } else {
      products = [...window.initialProducts];
      saveToStorage("products", products);
    }

    if (localStorage.getItem("customers")) {
      customers = JSON.parse(localStorage.getItem("customers"));
    } else {
      customers = [...window.initialCustomers];
      saveToStorage("customers", customers);
    }

    if (localStorage.getItem("invoices")) {
      invoices = JSON.parse(localStorage.getItem("invoices"));
    } else {
      invoices = [...window.initialInvoices];
      saveToStorage("invoices", invoices);
    }

    // Set date to today
    document.getElementById("system-date").textContent = new Date().toISOString().split("T")[0];
    document.getElementById("billing-date").value = new Date().toISOString().split("T")[0];

    // Setup Theme
    setTheme(currentTheme);

    // Initial renders
    renderCategoryDropdowns();
    renderAll();
    setupEventListeners();
  }

  // --- STORAGE UTILITIES ---
  function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const moon = document.getElementById("moon-icon");
    const sun = document.getElementById("sun-icon");
    if (theme === "dark") {
      moon.style.display = "block";
      sun.style.display = "none";
    } else {
      moon.style.display = "none";
      sun.style.display = "block";
    }
    localStorage.setItem("theme", theme);
    currentTheme = theme;
  }

  // --- RENDER DISPATCHER ---
  function renderAll() {
    renderDashboard();
    renderInventory();
    renderBillingPanel();
    renderInvoicesList();
    renderCustomersList();
  }

  // --- ROUTING / NAV SWITCHING ---
  function switchTab(targetId) {
    // Hide all sections
    document.querySelectorAll(".app-section").forEach(sec => sec.classList.remove("active"));
    // Show target section
    const activeSec = document.getElementById(`section-${targetId}`);
    if (activeSec) activeSec.classList.add("active");

    // Manage sidebar items
    document.querySelectorAll(".sidebar-menu li").forEach(li => li.classList.remove("active"));
    const activeLi = document.querySelector(`.sidebar-menu li[data-target="${targetId}"]`);
    if (activeLi) activeLi.classList.add("active");

    // Update headers
    const title = document.getElementById("current-section-title");
    const desc = document.getElementById("current-section-desc");
    
    const meta = {
      dashboard: ["Dashboard", "Real-time business performance overview."],
      inventory: ["Inventory Management", "Track and manage stock levels, pricing, and reorder levels."],
      billing: ["Billing Terminal", "Create, customize, and issue client invoices with instant stock deductions."],
      invoices: ["Invoices Directory", "Browse invoice history, print past invoices, and perform backups."],
      customers: ["Customer Database", "Manage customer profiles, contact info, and track purchasing volumes."]
    };

    if (meta[targetId]) {
      title.textContent = meta[targetId][0];
      desc.textContent = meta[targetId][1];
    }

    // Specifc routines when loading sections
    if (targetId === "dashboard") {
      renderDashboard();
    } else if (targetId === "billing") {
      renderBillingPanel();
    }
  }

  // --- CATEGORY CACHING & DROPDOWN RENDER ---
  function renderCategoryDropdowns() {
    const filterSelect = document.getElementById("inventory-filter-category");
    const categories = [...new Set(products.map(p => p.category))];
    
    // Clear dynamic options
    filterSelect.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      filterSelect.appendChild(opt);
    });
  }

  // --- 1. DASHBOARD COMPONENT RENDERER ---
  function renderDashboard() {
    // Calculates
    const totalRev = invoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
    const stockVal = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const lowStockCount = products.filter(p => p.stock <= p.reorderLevel).length;
    const invCount = invoices.length;

    // Set stats card values
    document.getElementById("stat-revenue").textContent = `$${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById("stat-stock-value").textContent = `$${stockVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById("stat-low-stock").textContent = lowStockCount;
    document.getElementById("stat-invoice-count").textContent = invCount;

    // Render Alerts Panel (Low Stock Items)
    const alertList = document.getElementById("dashboard-low-stock-list");
    alertList.innerHTML = "";
    
    const lowStockItems = products.filter(p => p.stock <= p.reorderLevel);
    if (lowStockItems.length === 0) {
      alertList.innerHTML = '<li style="color: var(--text-muted); font-style: italic; text-align: center; padding: 20px 0;">All inventory stocks are healthy.</li>';
    } else {
      lowStockItems.slice(0, 5).forEach(p => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.padding = "8px 12px";
        li.style.borderRadius = "var(--border-radius-sm)";
        li.style.backgroundColor = "rgba(245, 158, 11, 0.05)";
        li.style.borderLeft = "4px solid var(--color-warning)";
        
        li.innerHTML = `
          <div>
            <div style="font-weight: 600; font-size: 13px;">${escapeHTML(p.name)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">SKU: ${escapeHTML(p.sku)}</div>
          </div>
          <div style="text-align: right;">
            <div class="badge badge-warning">${p.stock} units left</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Min req: ${p.reorderLevel}</div>
          </div>
        `;
        alertList.appendChild(li);
      });
    }

    // Render Recent Invoices
    const recentInvoicesTbody = document.getElementById("dashboard-invoices-tbody");
    recentInvoicesTbody.innerHTML = "";
    const recentInvoices = [...invoices].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

    if (recentInvoices.length === 0) {
      recentInvoicesTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-style: italic;">No invoices issued yet.</td></tr>';
    } else {
      recentInvoices.forEach(inv => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-weight: 600; color: var(--color-primary);">${escapeHTML(inv.id)}</td>
          <td><strong>${escapeHTML(inv.customerName)}</strong></td>
          <td>${formatDate(inv.date)}</td>
          <td style="font-weight: 600;">$${inv.total.toFixed(2)}</td>
          <td><span class="badge badge-success">PAID</span></td>
          <td>
            <button class="btn-icon view-invoice-btn" data-id="${inv.id}" title="View Details">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        `;
        recentInvoicesTbody.appendChild(tr);
      });
    }

    // Dynamic Chart rendering
    drawRevenueChart();
  }

  // --- PURE JS DYNAMIC SVG CHARTING ENGINE ---
  function drawRevenueChart() {
    const chartWrapper = document.getElementById("revenue-chart-wrapper");
    if (!chartWrapper) return;
    
    chartWrapper.innerHTML = ""; // Clear
    
    // Group sales data of last 6 months (or custom past interval)
    // For visualization, we will construct a set of months
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlySales = {};
    
    // Initialize last 6 months
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlySales[key] = { label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`, amount: 0 };
    }

    // Populate data
    invoices.forEach(inv => {
      const invDate = new Date(inv.date);
      const key = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlySales[key]) {
        monthlySales[key].amount += inv.total;
      }
    });

    const data = Object.values(monthlySales);
    const maxVal = Math.max(...data.map(d => d.amount), 500); // minimum scale peak at 500

    // Setup SVG dimensions
    const width = chartWrapper.clientWidth || 500;
    const height = chartWrapper.clientHeight || 280;
    const paddingLeft = 50;
    const paddingBottom = 40;
    const paddingTop = 20;
    const paddingRight = 20;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Create SVG Elements
    let svgContent = `
      <svg class="svg-chart" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--color-primary)" />
            <stop offset="100%" stop-color="var(--color-secondary)" />
          </linearGradient>
          <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
    `;

    // Horizontal Gridlines & Y-Axis labels
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const val = (maxVal / gridCount) * i;
      const y = chartHeight + paddingTop - (chartHeight / gridCount) * i;
      
      svgContent += `
        <line class="chart-grid-line" x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" />
        <text class="chart-text" x="${paddingLeft - 10}" y="${y + 4}" text-anchor="end">$${Math.round(val)}</text>
      `;
    }

    // Columns Bar Rendering
    const colCount = data.length;
    const colSpacing = chartWidth / colCount;
    const barWidth = colSpacing * 0.45;

    // Points coordinate storage for drawing trend line overlay
    const points = [];

    data.forEach((d, idx) => {
      const x = paddingLeft + (colSpacing * idx) + (colSpacing - barWidth) / 2;
      const barHeight = (d.amount / maxVal) * chartHeight;
      const y = chartHeight + paddingTop - barHeight;

      // Draw Bar
      svgContent += `
        <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" />
      `;

      // Track middle-top point coordinates for trend line overlay
      points.push({ x: x + barWidth / 2, y: y });

      // Labels under columns
      svgContent += `
        <text class="chart-text" x="${x + barWidth / 2}" y="${chartHeight + paddingTop + 20}" text-anchor="middle">${d.label}</text>
      `;
    });

    // Draw overlay trend line connecting the sales bars
    if (points.length > 1) {
      let linePath = `M ${points[0].x} ${points[0].y}`;
      let areaPath = `M ${points[0].x} ${chartHeight + paddingTop} L ${points[0].x} ${points[0].y}`;
      
      for (let i = 1; i < points.length; i++) {
        linePath += ` L ${points[i].x} ${points[i].y}`;
        areaPath += ` L ${points[i].x} ${points[i].y}`;
      }
      areaPath += ` L ${points[points.length - 1].x} ${chartHeight + paddingTop} Z`;

      // Render Area background glow & actual stroke line
      svgContent += `
        <path class="chart-line-area" d="${areaPath}" />
        <path class="chart-line" d="${linePath}" />
      `;

      // Render dot handles
      points.forEach((p, idx) => {
        svgContent += `
          <circle class="chart-point" cx="${p.x}" cy="${p.y}" r="5" />
        `;
      });
    }

    svgContent += `</svg>`;
    chartWrapper.innerHTML = svgContent;
  }

  // --- 2. INVENTORY SECTION RENDERER ---
  function renderInventory() {
    const tbody = document.getElementById("inventory-tbody");
    tbody.innerHTML = "";

    const searchVal = document.getElementById("inventory-search").value.toLowerCase();
    const catVal = document.getElementById("inventory-filter-category").value;
    const statusVal = document.getElementById("inventory-filter-status").value;

    const filtered = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchVal) || p.sku.toLowerCase().includes(searchVal);
      const matchCat = catVal === "all" || p.category === catVal;
      
      let matchStatus = true;
      if (statusVal === "low") {
        matchStatus = p.stock <= p.reorderLevel;
      } else if (statusVal === "instock") {
        matchStatus = p.stock > p.reorderLevel;
      } else if (statusVal === "out") {
        matchStatus = p.stock === 0;
      }

      return matchSearch && matchCat && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-style: italic;">No matching products found.</td></tr>';
      return;
    }

    filtered.forEach(p => {
      const tr = document.createElement("tr");
      
      let badgeClass = "badge-success";
      let statusText = "In Stock";
      if (p.stock === 0) {
        badgeClass = "badge-danger";
        statusText = "Out of Stock";
      } else if (p.stock <= p.reorderLevel) {
        badgeClass = "badge-warning";
        statusText = "Low Stock Alert";
      }

      tr.innerHTML = `
        <td style="font-family: monospace; font-weight: 600;">${escapeHTML(p.sku)}</td>
        <td><strong>${escapeHTML(p.name)}</strong></td>
        <td>${escapeHTML(p.category)}</td>
        <td style="font-weight: 600;">$${p.price.toFixed(2)}</td>
        <td>${p.stock} units</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon edit-product-btn" data-id="${p.id}" title="Edit Product">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icon delete-product-btn" data-id="${p.id}" style="color: var(--color-danger);" title="Delete Product">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- 3. BILLING SCREEN RENDERER ---
  function renderBillingPanel() {
    // A. Populate Customer selector
    const customerSelect = document.getElementById("billing-customer");
    const prevCustVal = customerSelect.value;
    customerSelect.innerHTML = '<option value="">-- Choose Customer --</option>';
    
    customers.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.email || 'No Email'})`;
      if (c.id === prevCustVal) opt.selected = true;
      customerSelect.appendChild(opt);
    });

    // B. Populate Product Selector
    const prodSelect = document.getElementById("billing-product-select");
    prodSelect.innerHTML = '<option value="">-- Select Product --</option>';
    products.forEach(p => {
      if (p.stock > 0) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} ($${p.price.toFixed(2)}) - ${p.stock} left`;
        prodSelect.appendChild(opt);
      }
    });

    // C. Render Billing Cart items table
    const cartTbody = document.getElementById("billing-cart-tbody");
    cartTbody.innerHTML = "";

    if (billingCart.length === 0) {
      cartTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px 0;">Billing cart is empty. Choose a product and click Add.</td></tr>';
    } else {
      billingCart.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <strong>${escapeHTML(item.productName)}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">SKU: ${escapeHTML(item.sku)}</div>
          </td>
          <td>$${item.price.toFixed(2)}</td>
          <td>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
              <button class="btn btn-secondary btn-sm cart-qty-minus-btn" data-id="${item.productId}" style="padding: 2px 8px;">-</button>
              <span style="font-weight: 600; font-size: 14px; min-width: 20px; text-align: center;">${item.quantity}</span>
              <button class="btn btn-secondary btn-sm cart-qty-plus-btn" data-id="${item.productId}" style="padding: 2px 8px;">+</button>
            </div>
          </td>
          <td style="font-weight: 600;">$${item.total.toFixed(2)}</td>
          <td>
            <button class="btn-icon delete-cart-item-btn" data-id="${item.productId}" style="color: var(--color-danger);">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </td>
        `;
        cartTbody.appendChild(tr);
      });
    }

    // Recalculate invoice metrics
    recalculateInvoiceData();
  }

  function recalculateInvoiceData() {
    const subtotal = billingCart.reduce((sum, item) => sum + item.total, 0);
    const taxRate = parseFloat(document.getElementById("billing-tax").value) || 0;
    const discRate = parseFloat(document.getElementById("billing-discount").value) || 0;

    const discountAmount = (subtotal * discRate) / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * taxRate) / 100;
    const grandTotal = taxableAmount + taxAmount;

    // Update values inside billing cart summary fields (preview invoice sheets)
    document.getElementById("paper-subtotal").textContent = `$${subtotal.toFixed(2)}`;
    
    const paperDiscountRow = document.getElementById("paper-discount-row");
    if (discountAmount > 0) {
      paperDiscountRow.style.display = "table-row";
      document.getElementById("paper-discount").textContent = `-$${discountAmount.toFixed(2)} (${discRate}%)`;
    } else {
      paperDiscountRow.style.display = "none";
    }

    document.getElementById("paper-tax").textContent = `$${taxAmount.toFixed(2)} (${taxRate}%)`;
    document.getElementById("paper-total").textContent = `$${grandTotal.toFixed(2)}`;

    // Render Preview Items Table
    const paperTbody = document.getElementById("paper-items-tbody");
    paperTbody.innerHTML = "";
    
    if (billingCart.length === 0) {
      paperTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">No products added to invoice</td></tr>';
    } else {
      billingCart.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${escapeHTML(item.productName)}</strong></td>
          <td style="text-align: right;">${item.quantity}</td>
          <td style="text-align: right;">$${item.price.toFixed(2)}</td>
          <td style="text-align: right; font-weight: 600;">$${item.total.toFixed(2)}</td>
        `;
        paperTbody.appendChild(tr);
      });
    }

    // Update Customer details on paper preview
    const customerId = document.getElementById("billing-customer").value;
    const selectedCust = customers.find(c => c.id === customerId);

    const paperCustName = document.getElementById("paper-customer-name");
    const paperCustEmail = document.getElementById("paper-customer-email");
    const paperCustPhone = document.getElementById("paper-customer-phone");
    const paperCustAddress = document.getElementById("paper-customer-address");

    if (selectedCust) {
      paperCustName.textContent = selectedCust.name;
      paperCustEmail.textContent = selectedCust.email || "No Email Provided";
      paperCustPhone.textContent = selectedCust.phone || "No Phone Provided";
      paperCustAddress.textContent = selectedCust.address || "No Address Provided";
    } else {
      paperCustName.textContent = "Select Customer Details";
      paperCustEmail.textContent = "";
      paperCustPhone.textContent = "";
      paperCustAddress.textContent = "";
    }

    // Auto Invoice ID calculation (increment INV-2026-XXXX)
    const nextInvId = computeNextInvoiceId();
    document.getElementById("paper-invoice-id").textContent = nextInvId;
  }

  function computeNextInvoiceId() {
    if (invoices.length === 0) return "INV-2026-0001";
    
    // Sort in order to find the highest count
    const sorted = [...invoices].sort((a,b) => b.id.localeCompare(a.id));
    const latestId = sorted[0].id;
    
    // Extract numerical parts
    const match = latestId.match(/INV-\d+-(\d+)/);
    if (match && match[1]) {
      const nextNum = parseInt(match[1]) + 1;
      return `INV-2026-${String(nextNum).padStart(4, '0')}`;
    }
    return `INV-2026-${String(invoices.length + 1).padStart(4, '0')}`;
  }

  // --- 4. INVOICES HISTORY RENDERER ---
  function renderInvoicesList() {
    const tbody = document.getElementById("invoices-tbody");
    tbody.innerHTML = "";

    const searchVal = document.getElementById("invoices-search").value.toLowerCase();

    const filtered = invoices.filter(inv => {
      return inv.id.toLowerCase().includes(searchVal) || inv.customerName.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-style: italic;">No matching invoices found in local database.</td></tr>';
      return;
    }

    // Display sort descending by invoice ID
    const sorted = [...filtered].sort((a,b) => b.id.localeCompare(a.id));

    sorted.forEach(inv => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--color-primary);">${escapeHTML(inv.id)}</td>
        <td><strong>${escapeHTML(inv.customerName)}</strong></td>
        <td>${formatDate(inv.date)}</td>
        <td>${inv.items.reduce((sum, item) => sum + item.quantity, 0)} items</td>
        <td>$${inv.subtotal.toFixed(2)}</td>
        <td style="font-weight: 600; color: var(--color-success);">$${inv.total.toFixed(2)}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon view-invoice-btn" data-id="${inv.id}" title="View & Print">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-icon delete-invoice-btn" data-id="${inv.id}" style="color: var(--color-danger);" title="Delete Record">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- 5. CUSTOMERS LIST RENDERER ---
  function renderCustomersList() {
    const tbody = document.getElementById("customers-tbody");
    tbody.innerHTML = "";

    const searchVal = document.getElementById("customers-search").value.toLowerCase();

    const filtered = customers.filter(c => {
      return c.name.toLowerCase().includes(searchVal) || 
             (c.email && c.email.toLowerCase().includes(searchVal)) || 
             (c.phone && c.phone.toLowerCase().includes(searchVal));
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-style: italic;">No matching customers found.</td></tr>';
      return;
    }

    filtered.forEach(c => {
      // Calculate total purchase amount
      const custInvoices = invoices.filter(inv => inv.customerId === c.id);
      const totalPurchase = custInvoices.reduce((sum, inv) => sum + inv.total, 0);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHTML(c.name)}</strong></td>
        <td>${escapeHTML(c.email || 'N/A')}</td>
        <td>${escapeHTML(c.phone || 'N/A')}</td>
        <td><span style="font-size: 12px; color: var(--text-secondary); max-width: 250px; display: inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(c.address || '')}">${escapeHTML(c.address || 'N/A')}</span></td>
        <td style="font-weight: 600; color: var(--color-primary);">$${totalPurchase.toFixed(2)} (${custInvoices.length} invoices)</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon edit-customer-btn" data-id="${c.id}" title="Edit Profile">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icon delete-customer-btn" data-id="${c.id}" style="color: var(--color-danger);" title="Delete Profile">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- INTERACTION EVENT BINDINGS ---
  function setupEventListeners() {
    // Sidebar Tabs Router clicks
    document.querySelectorAll(".sidebar-menu li").forEach(li => {
      li.addEventListener("click", (e) => {
        e.preventDefault();
        const target = li.getAttribute("data-target");
        switchTab(target);
      });
    });

    // Theme toggle button
    document.getElementById("theme-toggle").addEventListener("click", () => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
    });

    // Close Modal listeners
    document.querySelectorAll(".modal-close-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-modal");
        closeModal(modalId);
      });
    });

    // Form Submissions
    document.getElementById("product-form").addEventListener("submit", (e) => e.preventDefault());
    document.getElementById("customer-form").addEventListener("submit", (e) => e.preventDefault());

    // Save Product from modal
    document.getElementById("btn-save-product").addEventListener("click", () => {
      saveProductHandler();
    });

    // Trigger Product Modals (Add Mode)
    document.getElementById("btn-add-product").addEventListener("click", () => {
      document.getElementById("product-form").reset();
      document.getElementById("product-id").value = "";
      document.getElementById("product-modal-title").textContent = "Add New Product";
      openModal("modal-product");
    });

    // Edit and Delete Product Event delegation inside Table
    document.getElementById("inventory-tbody").addEventListener("click", (e) => {
      const target = e.target.closest("button");
      if (!target) return;

      const prodId = target.getAttribute("data-id");
      if (target.classList.contains("edit-product-btn")) {
        const product = products.find(p => p.id === prodId);
        if (product) {
          document.getElementById("product-id").value = product.id;
          document.getElementById("product-name").value = product.name;
          document.getElementById("product-sku").value = product.sku;
          document.getElementById("product-category").value = product.category;
          document.getElementById("product-price").value = product.price;
          document.getElementById("product-stock").value = product.stock;
          document.getElementById("product-reorder").value = product.reorderLevel;
          
          document.getElementById("product-modal-title").textContent = "Edit Product Details";
          openModal("modal-product");
        }
      } else if (target.classList.contains("delete-product-btn")) {
        if (confirm("Are you sure you want to delete this product? All transaction history logs remain intact.")) {
          products = products.filter(p => p.id !== prodId);
          saveToStorage("products", products);
          renderCategoryDropdowns();
          renderAll();
        }
      }
    });

    // Live search filters for inventory
    document.getElementById("inventory-search").addEventListener("input", renderInventory);
    document.getElementById("inventory-filter-category").addEventListener("change", renderInventory);
    document.getElementById("inventory-filter-status").addEventListener("change", renderInventory);

    // Save Customer profile handler
    document.getElementById("btn-save-customer").addEventListener("click", () => {
      saveCustomerHandler();
    });

    // Trigger Customer Modals (Add Mode)
    document.getElementById("btn-add-customer").addEventListener("click", () => {
      document.getElementById("customer-form").reset();
      document.getElementById("customer-id").value = "";
      document.getElementById("customer-modal-title").textContent = "Add New Customer";
      openModal("modal-customer");
    });

    // Edit and Delete Customer Event delegation inside Table
    document.getElementById("customers-tbody").addEventListener("click", (e) => {
      const target = e.target.closest("button");
      if (!target) return;

      const custId = target.getAttribute("data-id");
      if (target.classList.contains("edit-customer-btn")) {
        const cust = customers.find(c => c.id === custId);
        if (cust) {
          document.getElementById("customer-id").value = cust.id;
          document.getElementById("customer-name").value = cust.name;
          document.getElementById("customer-email").value = cust.email || "";
          document.getElementById("customer-phone").value = cust.phone || "";
          document.getElementById("customer-address").value = cust.address || "";
          
          document.getElementById("customer-modal-title").textContent = "Edit Customer Profile";
          openModal("modal-customer");
        }
      } else if (target.classList.contains("delete-customer-btn")) {
        if (confirm("Are you sure you want to delete this customer profile?")) {
          customers = customers.filter(c => c.id !== custId);
          saveToStorage("customers", customers);
          renderAll();
        }
      }
    });

    // Live search filters for Customers
    document.getElementById("customers-search").addEventListener("input", renderCustomersList);

    // Billing Inputs trigger recalculations
    document.getElementById("billing-customer").addEventListener("change", recalculateInvoiceData);
    document.getElementById("billing-discount").addEventListener("input", recalculateInvoiceData);
    document.getElementById("billing-tax").addEventListener("input", recalculateInvoiceData);

    // Add Item to Billing Cart
    document.getElementById("btn-add-to-billing").addEventListener("click", () => {
      const prodId = document.getElementById("billing-product-select").value;
      const qty = parseInt(document.getElementById("billing-product-qty").value) || 1;

      if (!prodId) {
        alert("Please choose a product first.");
        return;
      }

      const prod = products.find(p => p.id === prodId);
      if (!prod) return;

      // Check current draft quantity against total in stock
      const existingInCart = billingCart.find(item => item.productId === prodId);
      const currentCartQty = existingInCart ? existingInCart.quantity : 0;
      const totalRequested = currentCartQty + qty;

      if (totalRequested > prod.stock) {
        alert(`Insufficient stock level. Only ${prod.stock} units available, but ${totalRequested} requested in draft.`);
        return;
      }

      if (existingInCart) {
        existingInCart.quantity = totalRequested;
        existingInCart.total = existingInCart.quantity * existingInCart.price;
      } else {
        billingCart.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          price: prod.price,
          quantity: qty,
          total: qty * prod.price
        });
      }

      // Reset Selector
      document.getElementById("billing-product-select").value = "";
      document.getElementById("billing-product-qty").value = "1";

      renderBillingPanel();
    });

    // Quantity modifiers inside Draft Billing table
    document.getElementById("billing-cart-tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const itemId = btn.getAttribute("data-id");
      const item = billingCart.find(x => x.productId === itemId);
      if (!item) return;

      const prod = products.find(p => p.id === itemId);

      if (btn.classList.contains("cart-qty-plus-btn")) {
        if (item.quantity + 1 > prod.stock) {
          alert(`Insufficient stock. Only ${prod.stock} units of ${prod.name} are available.`);
          return;
        }
        item.quantity += 1;
        item.total = item.quantity * item.price;
      } else if (btn.classList.contains("cart-qty-minus-btn")) {
        item.quantity -= 1;
        if (item.quantity <= 0) {
          billingCart = billingCart.filter(x => x.productId !== itemId);
        } else {
          item.total = item.quantity * item.price;
        }
      } else if (btn.classList.contains("delete-cart-item-btn")) {
        billingCart = billingCart.filter(x => x.productId !== itemId);
      }

      renderBillingPanel();
    });

    // Clear Draft Cart
    document.getElementById("btn-clear-billing").addEventListener("click", () => {
      if (confirm("Reset current active invoice draft?")) {
        billingCart = [];
        renderBillingPanel();
      }
    });

    // Save & Issue Invoice
    document.getElementById("btn-generate-invoice").addEventListener("click", () => {
      issueInvoiceHandler();
    });

    // Search past Invoices list
    document.getElementById("invoices-search").addEventListener("input", renderInvoicesList);

    // Invoices list view/print and delete events delegation
    document.getElementById("invoices-tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const invId = btn.getAttribute("data-id");
      const invoice = invoices.find(inv => inv.id === invId);

      if (btn.classList.contains("view-invoice-btn")) {
        showInvoiceDetailModal(invoice);
      } else if (btn.classList.contains("delete-invoice-btn")) {
        if (confirm(`Delete invoice ${invId}? Note: Deleting invoices does not automatically restock items.`)) {
          invoices = invoices.filter(i => i.id !== invId);
          saveToStorage("invoices", invoices);
          renderAll();
        }
      }
    });

    // Dashboard Recent Invoice clicks view hook
    document.getElementById("dashboard-invoices-tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const invId = btn.getAttribute("data-id");
      const invoice = invoices.find(inv => inv.id === invId);
      if (invoice && btn.classList.contains("view-invoice-btn")) {
        showInvoiceDetailModal(invoice);
      }
    });

    // In-modal Print trigger
    document.getElementById("btn-print-invoice").addEventListener("click", () => {
      window.print();
    });

    // Database Export
    document.getElementById("btn-export-db").addEventListener("click", () => {
      const dbDump = {
        products,
        customers,
        invoices,
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(dbDump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stockbill_db_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Database Import File select
    document.getElementById("import-file-input").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported.products && imported.customers && imported.invoices) {
            if (confirm("Importing backup data will overwrite your local browser database. Continue?")) {
              products = imported.products;
              customers = imported.customers;
              invoices = imported.invoices;
              
              saveToStorage("products", products);
              saveToStorage("customers", customers);
              saveToStorage("invoices", invoices);
              
              renderCategoryDropdowns();
              renderAll();
              alert("Database successfully imported and applied!");
            }
          } else {
            alert("Failed to parse file. Invalid backup format.");
          }
        } catch (err) {
          alert("Error parsing backup data: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // --- SAVE PRODUCT TRANSACTION ---
  function saveProductHandler() {
    const idField = document.getElementById("product-id").value;
    const name = document.getElementById("product-name").value.trim();
    const sku = document.getElementById("product-sku").value.trim().toUpperCase();
    const category = document.getElementById("product-category").value.trim();
    const price = parseFloat(document.getElementById("product-price").value) || 0;
    const stock = parseInt(document.getElementById("product-stock").value) || 0;
    const reorder = parseInt(document.getElementById("product-reorder").value) || 0;

    if (!name || !sku || !category) {
      alert("Please fill out all mandatory product fields.");
      return;
    }

    if (idField) {
      // Edit mode
      const idx = products.findIndex(p => p.id === idField);
      if (idx !== -1) {
        products[idx] = { id: idField, name, sku, category, price, stock, reorderLevel: reorder };
      }
    } else {
      // Add mode
      // Check duplicate SKU
      if (products.some(p => p.sku === sku)) {
        alert("A product with this SKU code already exists. Please choose a unique SKU.");
        return;
      }

      const newId = "p_" + Date.now();
      products.push({ id: newId, name, sku, category, price, stock, reorderLevel: reorder });
    }

    saveToStorage("products", products);
    renderCategoryDropdowns();
    renderAll();
    closeModal("modal-product");
  }

  // --- SAVE CUSTOMER TRANSACTION ---
  function saveCustomerHandler() {
    const idField = document.getElementById("customer-id").value;
    const name = document.getElementById("customer-name").value.trim();
    const email = document.getElementById("customer-email").value.trim();
    const phone = document.getElementById("customer-phone").value.trim();
    const address = document.getElementById("customer-address").value.trim();

    if (!name) {
      alert("Name / Business Title is required.");
      return;
    }

    if (idField) {
      // Edit mode
      const idx = customers.findIndex(c => c.id === idField);
      if (idx !== -1) {
        customers[idx] = { id: idField, name, email, phone, address };
      }
    } else {
      // Add mode
      const newId = "c_" + Date.now();
      customers.push({ id: newId, name, email, phone, address });
    }

    saveToStorage("customers", customers);
    renderAll();
    closeModal("modal-customer");
  }

  // --- ISSUE NEW INVOICE ---
  function issueInvoiceHandler() {
    const customerId = document.getElementById("billing-customer").value;
    const billDate = document.getElementById("billing-date").value;
    const taxRate = parseFloat(document.getElementById("billing-tax").value) || 0;
    const discRate = parseFloat(document.getElementById("billing-discount").value) || 0;

    if (!customerId) {
      alert("Please select a target client/customer.");
      return;
    }

    if (billingCart.length === 0) {
      alert("The invoice cart is empty. Please add items before generating an invoice.");
      return;
    }

    const selectedCust = customers.find(c => c.id === customerId);
    if (!selectedCust) return;

    const subtotal = billingCart.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = (subtotal * discRate) / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * taxRate) / 100;
    const grandTotal = taxableAmount + taxAmount;
    
    const invoiceId = computeNextInvoiceId();

    // 1. Deduct Product Stocks
    billingCart.forEach(cartItem => {
      const pIdx = products.findIndex(p => p.id === cartItem.productId);
      if (pIdx !== -1) {
        products[pIdx].stock = Math.max(0, products[pIdx].stock - cartItem.quantity);
      }
    });
    saveToStorage("products", products);

    // 2. Add Invoice object
    const newInvoice = {
      id: invoiceId,
      customerId: selectedCust.id,
      customerName: selectedCust.name,
      date: new Date(billDate).toISOString(),
      items: [...billingCart],
      subtotal,
      taxRate,
      taxAmount,
      discountRate: discRate,
      discountAmount,
      total: grandTotal
    };
    
    invoices.push(newInvoice);
    saveToStorage("invoices", invoices);

    // 3. Clear State and Drafts
    billingCart = [];
    document.getElementById("billing-customer").value = "";
    document.getElementById("billing-discount").value = "0";
    
    // 4. Render Updates
    renderAll();

    // 5. Open invoice details modal directly for the newly generated invoice
    showInvoiceDetailModal(newInvoice);
  }

  // --- INVOICE VIEW DETAILS MODAL HANDLER ---
  function showInvoiceDetailModal(invoice) {
    const container = document.getElementById("viewer-invoice-paper-container");
    container.innerHTML = "";

    // Find customer details from current customer records (fallbacks on invoice properties if deleted)
    const cust = customers.find(c => c.id === invoice.customerId) || {
      name: invoice.customerName,
      email: "No record / Deleted",
      phone: "N/A",
      address: "N/A"
    };

    // Calculate item list rows
    let itemRowsHtml = "";
    invoice.items.forEach(item => {
      itemRowsHtml += `
        <tr>
          <td><strong>${escapeHTML(item.productName)}</strong></td>
          <td style="text-align: right;">${item.quantity}</td>
          <td style="text-align: right;">$${item.price.toFixed(2)}</td>
          <td style="text-align: right; font-weight: 600;">$${item.total.toFixed(2)}</td>
        </tr>
      `;
    });

    // Create cloned invoice paper
    const paperHtml = `
      <div class="invoice-paper" style="border: none; box-shadow: none;">
        <div class="invoice-paper-header">
          <div class="company-details">
            <h2>STOCKBILL PRO LLC</h2>
            <p>Suite 101, Business Towers</p>
            <p>Springfield, US 45678</p>
            <p>Email: finance@stockbillpro.com</p>
          </div>
          <div class="invoice-meta">
            <h3>INVOICE</h3>
            <p>Invoice #: <span>${escapeHTML(invoice.id)}</span></p>
            <p>Date: <span>${formatDate(invoice.date)}</span></p>
          </div>
        </div>

        <div class="invoice-parties">
          <div class="party-box">
            <h4>Billed To:</h4>
            <p><strong>${escapeHTML(cust.name)}</strong></p>
            <p>${escapeHTML(cust.email || '')}</p>
            <p>${escapeHTML(cust.phone || '')}</p>
            <p>${escapeHTML(cust.address || '')}</p>
          </div>
          <div class="party-box">
            <h4>Payment Terms:</h4>
            <p>Due upon receipt of invoice.</p>
            <p>Status: <strong style="color: var(--color-success);">PAID</strong></p>
          </div>
        </div>

        <table class="invoice-items-table">
          <thead>
            <tr>
              <th style="text-align: left;">Item Description</th>
              <th style="text-align: right; width: 80px;">Qty</th>
              <th style="text-align: right; width: 100px;">Rate</th>
              <th style="text-align: right; width: 100px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
        </table>

        <div class="invoice-totals">
          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">$${invoice.subtotal.toFixed(2)}</td>
            </tr>
            ${invoice.discountAmount > 0 ? `
              <tr>
                <td>Discount (${invoice.discountRate}%):</td>
                <td style="text-align: right; color: var(--color-danger); font-weight: 500;">-$${invoice.discountAmount.toFixed(2)}</td>
              </tr>
            ` : ""}
            <tr>
              <td>Tax (${invoice.taxRate}%):</td>
              <td style="text-align: right;">$${invoice.taxAmount.toFixed(2)}</td>
            </tr>
            <tr class="grand-total">
              <td>Total Due:</td>
              <td style="text-align: right;">$${invoice.total.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="invoice-footer-notes">
          <p>Thank you for your business!</p>
          <p style="margin-top: 4px; font-size: 9px; opacity: 0.8;">Generated digitally by StockBill Pro</p>
        </div>
      </div>
    `;

    container.innerHTML = paperHtml;
    openModal("modal-invoice-detail");
  }

  // --- GENERAL MODAL CONTROL ---
  function openModal(modalId) {
    document.getElementById(modalId).classList.add("active");
  }

  function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
  }

  // --- ESCAPE AND HELPERS UTILITY ---
  function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  function formatDate(isoStr) {
    if (!isoStr) return "";
    const date = new Date(isoStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit"
    });
  }

  // Window size hook to re-draw SVG chart on window resize (responsiveness)
  window.addEventListener("resize", () => {
    // Only redraw if Dashboard is active
    if (document.getElementById("section-dashboard").classList.contains("active")) {
      drawRevenueChart();
    }
  });

  // Start initialization
  init();
});
