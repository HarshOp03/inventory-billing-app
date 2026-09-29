// StockPro - Inventory Management & Dashboard Core Script (LocalStorage Engine)
document.addEventListener("DOMContentLoaded", () => {
  // --- APPLICATION STATE & CONFIG ---
  let products = [];
  let customers = [];
  let invoices = [];
  let posCart = [];
  let selectedPaymentMethod = "cash";
  let merchantUpi = localStorage.getItem("stockpro_upi") || "stockpro@upi";
  let qrPaymentVerified = false;
  let currentTheme = localStorage.getItem("theme") || "dark";

  // --- INITIALIZATION ---
  /**
   * Initializes the application state, loads data from localStorage or fallback mock data,
   * sets the current system date, initializes the theme, and attaches event listeners.
   */
  function init() {
    // Load products from localStorage or fallback to bootstrap mock data
    const savedProducts = getFromStorage("products");
    if (savedProducts && Array.isArray(savedProducts) && savedProducts.length > 0) {
      products = savedProducts;
    } else if (window.initialProducts && Array.isArray(window.initialProducts)) {
      products = [...window.initialProducts];
      saveToStorage("products", products);
    } else {
      products = [];
    }

    // Load customers from localStorage or fallback to bootstrap mock data
    const savedCustomers = getFromStorage("customers");
    if (savedCustomers && Array.isArray(savedCustomers) && savedCustomers.length > 0) {
      customers = savedCustomers;
    } else if (window.initialCustomers && Array.isArray(window.initialCustomers)) {
      customers = [...window.initialCustomers];
      saveToStorage("customers", customers);
    } else {
      customers = [];
    }

    // Load invoices from localStorage or fallback to bootstrap mock data
    const savedInvoices = getFromStorage("invoices");
    if (savedInvoices && Array.isArray(savedInvoices) && savedInvoices.length > 0) {
      invoices = savedInvoices;
    } else if (window.initialInvoices && Array.isArray(window.initialInvoices)) {
      invoices = [...window.initialInvoices];
      saveToStorage("invoices", invoices);
    } else {
      invoices = [];
    }

    // Set system date to today
    const dateElem = document.getElementById("system-date");
    if (dateElem) {
      dateElem.textContent = new Date().toISOString().split("T")[0];
    }

    // Setup Theme
    setTheme(currentTheme);

    // Initial renders
    renderCategoryDropdowns();
    renderAll();
    setupEventListeners();

    // Check user authentication session
    if (window.StockProAuth) {
      window.StockProAuth.checkSession();
    }
  }

  // --- STORAGE UTILITIES ---
  /**
   * Retrieves and parses JSON data from browser's localStorage.
   * @param {string} key - The localStorage item key.
   * @param {*} fallback - Default value if not found or invalid.
   * @returns {*}
   */
  function getFromStorage(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn(`Error reading ${key} from localStorage:`, e);
      return fallback;
    }
  }

  /**
   * Serializes JavaScript data into JSON and stores it in the browser's localStorage.
   * @param {string} key - The localStorage item key.
   * @param {*} data - The value or object to serialize and save.
   */
  function saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error writing ${key} to localStorage:`, e);
    }
  }

  /**
   * Sets the visual theme across the application by updating the data-theme attribute on <html>.
   * @param {string} theme - The target theme ("dark" or "light").
   */
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme || "dark");
  }

  // --- RENDER DISPATCHER ---
  /**
   * Master render dispatcher that refreshes Dashboard metrics, Inventory tables, and Billing/POS.
   */
  function renderAll() {
    renderDashboard();
    renderInventory();
    renderBilling();
  }

  // --- ROUTING / NAV SWITCHING ---
  /**
   * Handles SPA view/tab navigation (e.g. switching between "dashboard", "inventory", and "billing").
   * Updates visibility of sections, highlights active sidebar and mobile navigation items,
   * updates page titles, triggers view-specific renders, and closes the mobile drawer.
   * @param {string} targetId - The ID of the target section ("dashboard", "inventory", or "billing").
   */
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

    // Manage mobile bottom nav items
    document.querySelectorAll(".mobile-bottom-nav .mobile-nav-btn").forEach(btn => btn.classList.remove("active"));
    const activeMobileBtn = document.querySelector(`.mobile-bottom-nav .mobile-nav-btn[data-target="${targetId}"]`);
    if (activeMobileBtn) activeMobileBtn.classList.add("active");

    // Update header texts
    const title = document.getElementById("current-section-title");
    const desc = document.getElementById("current-section-desc");
    
    const meta = {
      dashboard: ["Dashboard", "Real-time inventory overview & performance."],
      inventory: ["Inventory Management", "Track and manage stock levels, pricing, and reorder levels."],
      billing: ["Billing & POS Terminal", "Generate sales receipts, manage transactions, and accept QR/cash payments."]
    };

    if (meta[targetId] && title && desc) {
      title.textContent = meta[targetId][0];
      desc.textContent = meta[targetId][1];
    }

    // Routines when loading sections
    if (targetId === "dashboard") {
      renderDashboard();
    } else if (targetId === "inventory") {
      renderInventory();
    } else if (targetId === "billing") {
      renderBilling();
    }

    // Auto-close mobile sidebar if open
    closeMobileSidebar();
    
    // Scroll window smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Mobile Drawer Controls
  /**
   * Opens the slide-out navigation sidebar drawer on mobile devices
   * and displays the semi-transparent backdrop overlay.
   */
  function openMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("active");
  }

  /**
   * Closes the slide-out navigation sidebar drawer on mobile devices
   * and hides the backdrop overlay.
   */
  function closeMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("active");
  }

  // --- CATEGORY CACHING & DROPDOWN RENDER ---
  /**
   * Extracts unique product categories from the products array, sorts them alphabetically,
   * and populates the inventory filter dropdown while retaining the currently selected option.
   */
  function renderCategoryDropdowns() {
    const filterSelect = document.getElementById("inventory-filter-category");
    if (!filterSelect) return;

    const currentVal = filterSelect.value;
    const categories = [...new Set(products.map(p => p.category))].sort();
    
    filterSelect.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      if (cat === currentVal) opt.selected = true;
      filterSelect.appendChild(opt);
    });
  }

  // --- 1. DASHBOARD COMPONENT RENDERER ---
  /**
   * Formats numeric amounts as Indian Rupees (₹) with en-IN numbering.
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Calculates dashboard summary statistics (total products, inventory valuation,
   * total stock units, low stock count), updates metric cards, renders the low stock
   * alert notification list, populates recent stock overview table rows, and calls drawCategoryChart().
   */
  function renderDashboard() {
    // Metrics calculation
    const totalProducts = products.length;
    const stockVal = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const lowStockCount = products.filter(p => p.stock <= p.reorderLevel).length;

    // Stat cards
    const prodCountElem = document.getElementById("stat-products-count");
    const stockValElem = document.getElementById("stat-stock-value");
    const totalStockElem = document.getElementById("stat-total-stock");
    const lowStockElem = document.getElementById("stat-low-stock");

    if (prodCountElem) prodCountElem.textContent = totalProducts;
    if (stockValElem) stockValElem.textContent = formatCurrency(stockVal);
    if (totalStockElem) totalStockElem.textContent = totalUnits.toLocaleString('en-US');
    if (lowStockElem) lowStockElem.textContent = lowStockCount;

    // Render Low Stock Warning List
    const alertList = document.getElementById("dashboard-low-stock-list");
    if (alertList) {
      alertList.innerHTML = "";
      const lowStockItems = products.filter(p => p.stock <= p.reorderLevel);
      if (lowStockItems.length === 0) {
        alertList.innerHTML = '<li style="color: var(--text-muted); font-style: italic; text-align: center; padding: 24px 0;">All inventory stocks are healthy.</li>';
      } else {
        lowStockItems.slice(0, 5).forEach(p => {
          const li = document.createElement("li");
          li.style.display = "flex";
          li.style.justifyContent = "space-between";
          li.style.alignItems = "center";
          li.style.padding = "10px 12px";
          li.style.borderRadius = "var(--border-radius-sm)";
          li.style.backgroundColor = "rgba(245, 158, 11, 0.08)";
          li.style.borderLeft = "4px solid var(--color-warning)";
          
          li.innerHTML = `
            <div>
              <div style="font-weight: 600; font-size: 13px;">${escapeHTML(p.name)}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">SKU: ${escapeHTML(p.sku)}</div>
            </div>
            <div style="text-align: right;">
              <div class="badge badge-warning">${p.stock} units left</div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Threshold: ${p.reorderLevel}</div>
            </div>
          `;
          alertList.appendChild(li);
        });
      }
    }

    // Render Stock Overview Table
    const overviewTbody = document.getElementById("dashboard-products-tbody");
    if (overviewTbody) {
      overviewTbody.innerHTML = "";
      if (products.length === 0) {
        overviewTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">No inventory records available. Click "Add Product" to get started.</td></tr>';
      } else {
        // Show up to 5 items in dashboard overview
        products.slice(0, 5).forEach(p => {
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

          const productTotalValue = p.price * p.stock;

          tr.innerHTML = `
            <td style="font-family: monospace; font-weight: 600;">${escapeHTML(p.sku)}</td>
            <td><strong>${escapeHTML(p.name)}</strong></td>
            <td>${escapeHTML(p.category)}</td>
            <td>${formatCurrency(p.price)}</td>
            <td><strong>${p.stock}</strong></td>
            <td style="font-weight: 600; color: var(--color-primary);">${formatCurrency(productTotalValue)}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
          `;
          overviewTbody.appendChild(tr);
        });
      }
    }

    // Dynamic Category Chart rendering
    drawCategoryChart();
  }

  // --- DYNAMIC SVG CATEGORY VALUATION CHART ---
  /**
   * Generates and renders a responsive SVG bar chart visualizing inventory valuation by category.
   * Aggregates total stock value and units per category, sorts categories descending by value,
   * dynamically draws Y-axis gridlines/ticks, and draws colored bars with value and category labels.
   */
  function drawCategoryChart() {
    const chartWrapper = document.getElementById("category-chart-wrapper");
    if (!chartWrapper) return;
    
    chartWrapper.innerHTML = ""; // Clear wrapper
    
    // Group products by category and calculate total value
    const categoryTotals = {};
    products.forEach(p => {
      const cat = p.category || "Uncategorized";
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { category: cat, value: 0, units: 0 };
      }
      categoryTotals[cat].value += (p.price * p.stock);
      categoryTotals[cat].units += p.stock;
    });

    const data = Object.values(categoryTotals);
    if (data.length === 0) {
      chartWrapper.innerHTML = '<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-style: italic;">No inventory data to chart.</div>';
      return;
    }

    // Sort by value descending
    data.sort((a, b) => b.value - a.value);

    const maxVal = Math.max(...data.map(d => d.value), 100);

    // Setup SVG dimensions based on parent container
    const width = chartWrapper.clientWidth || 500;
    const height = chartWrapper.clientHeight || 280;
    const paddingLeft = 55;
    const paddingBottom = 45;
    const paddingTop = 20;
    const paddingRight = 25;
    
    const chartWidth = Math.max(width - paddingLeft - paddingRight, 100);
    const chartHeight = Math.max(height - paddingTop - paddingBottom, 100);

    let svgContent = `
      <svg class="svg-chart" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--color-primary)" />
            <stop offset="100%" stop-color="var(--color-secondary)" />
          </linearGradient>
        </defs>
    `;

    // Horizontal Gridlines & Y-Axis values
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const val = (maxVal / gridCount) * i;
      const y = chartHeight + paddingTop - (chartHeight / gridCount) * i;
      
      svgContent += `
        <line class="chart-grid-line" x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" />
        <text class="chart-text" x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end">₹${Math.round(val).toLocaleString('en-IN')}</text>
      `;
    }

    // Columns Bar Rendering
    const colCount = data.length;
    const colSpacing = chartWidth / colCount;
    const barWidth = Math.min(Math.max(colSpacing * 0.5, 14), 44);

    data.forEach((d, idx) => {
      const x = paddingLeft + (colSpacing * idx) + (colSpacing - barWidth) / 2;
      const barHeight = Math.max((d.value / maxVal) * chartHeight, 4);
      const y = chartHeight + paddingTop - barHeight;

      // Truncate category label if too long
      const maxChar = width < 450 ? 6 : 10;
      const shortLabel = d.category.length > maxChar ? d.category.substring(0, maxChar - 1) + '..' : d.category;

      // Draw Bar with title tooltip
      svgContent += `
        <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}">
          <title>${escapeHTML(d.category)}: ${formatCurrency(d.value)} (${d.units} units)</title>
        </rect>
        <text class="chart-text" x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-weight="600" font-size="10">₹${Math.round(d.value).toLocaleString('en-IN')}</text>
        <text class="chart-text" x="${x + barWidth / 2}" y="${chartHeight + paddingTop + 20}" text-anchor="middle">${escapeHTML(shortLabel)}</text>
      `;
    });

    svgContent += `</svg>`;
    chartWrapper.innerHTML = svgContent;
  }

  // --- 2. INVENTORY SECTION RENDERER ---
  /**
   * Renders the product inventory table with live client-side filtering.
   * Filters records by search keyword (name or SKU), category, and stock status
   * (all, in stock, low stock, out of stock), then generates table rows with edit and delete actions.
   */
  function renderInventory() {
    const tbody = document.getElementById("inventory-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const searchElem = document.getElementById("inventory-search");
    const catElem = document.getElementById("inventory-filter-category");
    const statusElem = document.getElementById("inventory-filter-status");

    const searchVal = searchElem ? searchElem.value.trim().toLowerCase() : "";
    const catVal = catElem ? catElem.value : "all";
    const statusVal = statusElem ? statusElem.value : "all";

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
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 24px;">No matching products found.</td></tr>';
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
        <td style="font-weight: 600;">${formatCurrency(p.price)}</td>
        <td><strong>${p.stock}</strong> units</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn-icon edit-product-btn" data-id="${p.id}" title="Edit Product" aria-label="Edit Product">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icon delete-product-btn" data-id="${p.id}" style="color: var(--color-danger);" title="Delete Product" aria-label="Delete Product">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- SAVE PRODUCT HANDLER ---
  /**
   * Processes the Add/Edit Product modal form submission.
   * Validates mandatory fields (Name, SKU, Category), enforces unique SKUs,
   * saves product directly to localStorage, refreshes UI views, and closes the modal dialog.
   */
  function saveProductHandler() {
    const idField = document.getElementById("product-id").value;
    const name = document.getElementById("product-name").value.trim();
    const sku = document.getElementById("product-sku").value.trim().toUpperCase();
    const category = document.getElementById("product-category").value.trim();
    const price = parseFloat(document.getElementById("product-price").value) || 0;
    const stock = parseInt(document.getElementById("product-stock").value) || 0;
    const reorder = parseInt(document.getElementById("product-reorder").value) || 0;

    if (!name || !sku || !category) {
      alert("Please fill out all mandatory product fields (Name, SKU, Category).");
      return;
    }

    if (idField) {
      // Editing existing product
      const idx = products.findIndex(p => p.id === idField);
      if (idx !== -1) {
        if (products.some(p => p.sku === sku && p.id !== idField)) {
          alert("A different product already uses this SKU code. SKU must be unique.");
          return;
        }
        products[idx] = {
          ...products[idx],
          id: idField,
          name,
          sku,
          category,
          price,
          stock,
          reorderLevel: reorder,
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      // Adding new product
      if (products.some(p => p.sku === sku)) {
        alert("A product with this SKU code already exists. Please choose a unique SKU.");
        return;
      }
      const newId = "p_" + Date.now();
      products.unshift({
        id: newId,
        name,
        sku,
        category,
        price,
        stock,
        reorderLevel: reorder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    saveToStorage("products", products);
    renderCategoryDropdowns();
    renderAll();
    closeModal("modal-product");
  }

  // --- MODAL UTILITIES ---
  /**
   * Displays a modal overlay dialog by adding the "active" CSS class.
   * @param {string} modalId - The element ID of the modal dialog container.
   */
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("active");
  }

  /**
   * Hides an open modal overlay dialog by removing the "active" CSS class.
   * @param {string} modalId - The element ID of the modal dialog container.
   */
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("active");
  }

  // =============================================================================
  // --- 3. BILLING & POS SYSTEM FUNCTIONS ---
  // =============================================================================

  /**
   * Generates the next sequential invoice ID (e.g. INV-2026-0004).
   * @returns {string}
   */
  function getNextInvoiceId() {
    if (!invoices || invoices.length === 0) {
      return "INV-2026-0001";
    }
    let maxNum = 0;
    const year = new Date().getFullYear();
    invoices.forEach(inv => {
      if (inv.id && typeof inv.id === "string") {
        const parts = inv.id.split("-");
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `INV-${year}-${String(maxNum + 1).padStart(4, "0")}`;
  }

  /**
   * Updates the next invoice ID display badge in the POS subnav bar.
   */
  function updateNextInvoiceDisplay() {
    const display = document.getElementById("pos-invoice-no-display");
    if (display) {
      display.textContent = getNextInvoiceId();
    }
  }

  /**
   * Populates customer datalist suggestions for walk-in retail autocomplete.
   */
  function populateCustomerSuggestions() {
    const datalist = document.getElementById("customer-list-suggestions");
    if (!datalist) return;
    datalist.innerHTML = "";
    customers.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.label = `${c.phone || ""} ${c.email ? "(" + c.email + ")" : ""}`.trim();
      datalist.appendChild(opt);
    });
  }

  /**
   * Auto-fills customer phone if a matching customer name is selected.
   * @param {string} name
   */
  function handleCustomerNameInput(name) {
    if (!name) return;
    const matched = customers.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
    if (matched && matched.phone) {
      const phoneInput = document.getElementById("bill-customer-phone");
      if (phoneInput && !phoneInput.value) {
        phoneInput.value = matched.phone;
      }
    }
  }

  /**
   * Renders the product select options for the POS terminal.
   */
  function renderPosProductSelect() {
    const select = document.getElementById("pos-product-select");
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Choose Product from Inventory --</option>';

    products.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      const isOut = p.stock <= 0;
      opt.textContent = `${p.name} (${p.sku}) - ${formatCurrency(p.price)} [${isOut ? 'OUT OF STOCK' : p.stock + ' in stock'}]`;
      if (isOut) {
        opt.disabled = true;
      }
      if (p.id === currentVal && !isOut) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    updatePosStockAvail();
  }

  /**
   * Updates the real-time stock indicator label and qty field max attribute for selected product.
   */
  function updatePosStockAvail() {
    const select = document.getElementById("pos-product-select");
    const stockLabel = document.getElementById("pos-stock-avail");
    const qtyInput = document.getElementById("pos-product-qty");
    if (!select || !stockLabel) return;

    const prodId = select.value;
    const product = products.find(p => p.id === prodId);
    if (!product) {
      stockLabel.textContent = "Select item to view stock";
      stockLabel.style.color = "var(--text-muted)";
      if (qtyInput) qtyInput.max = "";
      return;
    }

    const inCart = posCart.find(i => i.productId === prodId);
    const inCartQty = inCart ? inCart.quantity : 0;
    const availStock = Math.max(0, product.stock - inCartQty);

    if (availStock <= 0) {
      stockLabel.textContent = `Out of stock! (In current bill: ${inCartQty})`;
      stockLabel.style.color = "var(--color-danger)";
    } else if (availStock <= product.reorderLevel) {
      stockLabel.textContent = `Low stock alert: ${availStock} available (${formatCurrency(product.price)})`;
      stockLabel.style.color = "var(--color-warning)";
    } else {
      stockLabel.textContent = `In stock: ${availStock} available (${formatCurrency(product.price)})`;
      stockLabel.style.color = "var(--color-success)";
    }

    if (qtyInput) {
      qtyInput.max = availStock > 0 ? availStock : 1;
      if (parseInt(qtyInput.value, 10) > availStock && availStock > 0) {
        qtyInput.value = availStock;
      }
    }
  }

  /**
   * Renders quick pick product chips for 1-click addition to bill.
   */
  function renderQuickProductChips() {
    const container = document.getElementById("quick-product-chips");
    if (!container) return;
    container.innerHTML = "";

    const inStock = products.filter(p => p.stock > 0).slice(0, 6);
    if (inStock.length === 0) {
      container.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">No in-stock items available</span>';
      return;
    }

    inStock.forEach(p => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "quick-chip";
      chip.title = `Click to add 1 unit of ${p.name}`;
      chip.innerHTML = `
        <span class="chip-name">${escapeHTML(p.name)}</span>
        <span class="chip-price">${formatCurrency(p.price)}</span>
        <span class="chip-stock">${p.stock} left</span>
      `;
      chip.addEventListener("click", () => {
        addItemToCart(p.id, 1);
      });
      container.appendChild(chip);
    });
  }

  /**
   * Adds a product to the current POS cart with stock validation.
   * @param {string} productId
   * @param {number} quantity
   */
  function addItemToCart(productId, quantity = 1) {
    const qty = parseInt(quantity, 10) || 1;
    if (qty <= 0) {
      alert("Please enter a valid quantity of at least 1.");
      return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
      alert("Please choose a valid product from the list.");
      return;
    }

    if (product.stock <= 0) {
      alert(`"${product.name}" is currently out of stock.`);
      return;
    }

    const existingItem = posCart.find(i => i.productId === productId);
    const currentQtyInCart = existingItem ? existingItem.quantity : 0;
    const requestedTotalQty = currentQtyInCart + qty;

    if (requestedTotalQty > product.stock) {
      alert(`Cannot add ${qty} more. Available inventory stock for "${product.name}" is ${product.stock} (already ${currentQtyInCart} in bill).`);
      return;
    }

    if (existingItem) {
      existingItem.quantity = requestedTotalQty;
      existingItem.total = existingItem.quantity * existingItem.price;
    } else {
      posCart.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price,
        quantity: qty,
        total: qty * product.price
      });
    }

    renderPosCart();
    calculateBillSummary();
    updatePosStockAvail();
  }

  /**
   * Updates an item's quantity in the POS cart.
   * @param {string} productId
   * @param {number} newQty
   */
  function updateCartItemQty(productId, newQty) {
    const qty = parseInt(newQty, 10);
    const itemIndex = posCart.findIndex(i => i.productId === productId);
    if (itemIndex === -1) return;

    const product = products.find(p => p.id === productId);
    const maxStock = product ? product.stock : 9999;

    if (isNaN(qty) || qty <= 0) {
      posCart.splice(itemIndex, 1);
    } else if (qty > maxStock) {
      alert(`Only ${maxStock} units of "${product ? product.name : 'this item'}" are in stock.`);
      posCart[itemIndex].quantity = maxStock;
      posCart[itemIndex].total = maxStock * posCart[itemIndex].price;
    } else {
      posCart[itemIndex].quantity = qty;
      posCart[itemIndex].total = qty * posCart[itemIndex].price;
    }

    renderPosCart();
    calculateBillSummary();
    updatePosStockAvail();
  }

  /**
   * Removes an item completely from the POS cart.
   * @param {string} productId
   */
  function removeCartItem(productId) {
    posCart = posCart.filter(i => i.productId !== productId);
    renderPosCart();
    calculateBillSummary();
    updatePosStockAvail();
  }

  /**
   * Clears all items from the POS cart after confirmation.
   */
  function clearCart() {
    if (posCart.length === 0) return;
    if (confirm("Are you sure you want to clear all items from the current bill?")) {
      posCart = [];
      renderPosCart();
      calculateBillSummary();
      updatePosStockAvail();
    }
  }

  /**
   * Renders the POS items table rows and updates item count badge.
   */
  function renderPosCart() {
    const tbody = document.getElementById("pos-items-tbody");
    const countBadge = document.getElementById("bill-items-count-badge");
    if (!tbody) return;

    const totalItemTypes = posCart.length;
    const totalPhysicalUnits = posCart.reduce((sum, i) => sum + i.quantity, 0);

    if (countBadge) {
      countBadge.textContent = `${totalItemTypes} item${totalItemTypes === 1 ? '' : 's'} (${totalPhysicalUnits} unit${totalPhysicalUnits === 1 ? '' : 's'})`;
    }

    if (posCart.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 32px 10px;">
            <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="1.5" fill="none" style="opacity: 0.4; margin-bottom: 6px;"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <div>No items in current bill.</div>
            <div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">Select a product above or click a Quick Pick item.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = "";
    posCart.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${escapeHTML(item.productName)}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">SKU: ${escapeHTML(item.sku)}</div>
        </td>
        <td style="white-space: nowrap;">${formatCurrency(item.price)}</td>
        <td style="text-align: center;">
          <div class="cart-qty-ctrl">
            <button type="button" class="cart-qty-btn btn-qty-minus" data-id="${item.productId}" title="Decrease quantity">−</button>
            <input type="number" class="cart-qty-input" value="${item.quantity}" min="1" data-id="${item.productId}">
            <button type="button" class="cart-qty-btn btn-qty-plus" data-id="${item.productId}" title="Increase quantity">+</button>
          </div>
        </td>
        <td style="text-align: right; font-weight: 600; color: var(--color-primary-light); white-space: nowrap;">
          ${formatCurrency(item.total)}
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn-cart-remove btn-item-remove" data-id="${item.productId}" title="Remove item">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /**
   * Recalculates subtotal, discounts, GST/tax, and grand total, updating UI and QR code.
   * @returns {object}
   */
  function calculateBillSummary() {
    const subtotalElem = document.getElementById("pos-subtotal");
    const discountAmountElem = document.getElementById("pos-discount-amount");
    const taxAmountElem = document.getElementById("pos-tax-amount");
    const grandTotalElem = document.getElementById("pos-grand-total");
    const discountTypeSelect = document.getElementById("pos-discount-type");
    const discountInput = document.getElementById("pos-discount-input");
    const taxSelect = document.getElementById("pos-tax-select");
    const liveTimeElem = document.getElementById("pos-live-time");

    if (liveTimeElem) {
      const now = new Date();
      liveTimeElem.textContent = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const subtotal = posCart.reduce((sum, item) => sum + item.total, 0);

    const discType = discountTypeSelect ? discountTypeSelect.value : "percent";
    const discVal = discountInput ? Math.max(0, parseFloat(discountInput.value) || 0) : 0;
    let discountAmount = 0;
    if (discType === "percent") {
      discountAmount = (subtotal * Math.min(100, discVal)) / 100;
    } else {
      discountAmount = Math.min(subtotal, discVal);
    }

    const taxRate = taxSelect && taxSelect.value !== "" ? (parseFloat(taxSelect.value) || 0) : 18;
    const taxableSubtotal = Math.max(0, subtotal - discountAmount);
    const taxAmount = (taxableSubtotal * taxRate) / 100;

    const grandTotal = Math.max(0, taxableSubtotal + taxAmount);

    if (subtotalElem) subtotalElem.textContent = formatCurrency(subtotal);
    if (discountAmountElem) discountAmountElem.textContent = `-${formatCurrency(discountAmount)}`;
    if (taxAmountElem) taxAmountElem.textContent = `+${formatCurrency(taxAmount)}`;
    if (grandTotalElem) grandTotalElem.textContent = formatCurrency(grandTotal);

    const qrCallout = document.getElementById("pos-qr-amount-callout");
    if (qrCallout) qrCallout.textContent = formatCurrency(grandTotal);

    if (selectedPaymentMethod === "qrcode") {
      renderQRCode(grandTotal);
    }

    updateCashChange(grandTotal);

    return {
      subtotal,
      discountType: discType,
      discountValue: discVal,
      discountAmount,
      taxRate,
      taxAmount,
      grandTotal
    };
  }

  /**
   * Updates cash change return or shortage calculations based on cash received input.
   * @param {number|null} forcedGrandTotal
   */
  function updateCashChange(forcedGrandTotal = null) {
    const cashInput = document.getElementById("pos-cash-received");
    const changeBox = document.getElementById("cash-change-box");
    if (!cashInput || !changeBox) return;

    let grandTotal = forcedGrandTotal;
    if (grandTotal === null) {
      const totals = calculateBillSummary();
      grandTotal = totals.grandTotal;
    }

    const cashReceived = parseFloat(cashInput.value);
    if (isNaN(cashReceived) || cashReceived === 0) {
      changeBox.className = "cash-change-display exact";
      changeBox.innerHTML = `
        <span class="change-label">Change to Return:</span>
        <strong class="change-value" id="pos-change-value">₹0.00</strong>
      `;
      return;
    }

    const diff = cashReceived - grandTotal;
    if (diff >= 0) {
      changeBox.className = "cash-change-display positive";
      changeBox.innerHTML = `
        <span class="change-label">Change to Return:</span>
        <strong class="change-value" id="pos-change-value">${formatCurrency(diff)}</strong>
      `;
    } else {
      changeBox.className = "cash-change-display negative";
      changeBox.innerHTML = `
        <span class="change-label" style="color: var(--color-danger);">Short Amount:</span>
        <strong class="change-value" id="pos-change-value" style="color: var(--color-danger);">${formatCurrency(Math.abs(diff))}</strong>
      `;
    }
  }

  /**
   * Handles quick preset cash button clicks (Exact, +50, +100, +500, Round 100).
   * @param {string} mode
   * @param {string|number} val
   */
  function handleCashPreset(mode, val) {
    const cashInput = document.getElementById("pos-cash-received");
    if (!cashInput) return;
    const totals = calculateBillSummary();
    const grandTotal = totals.grandTotal;
    let currentCash = parseFloat(cashInput.value) || 0;

    if (mode === "exact") {
      cashInput.value = Math.ceil(grandTotal);
    } else if (mode === "add") {
      const addVal = parseFloat(val) || 0;
      if (currentCash < grandTotal) {
        cashInput.value = Math.ceil(grandTotal) + addVal;
      } else {
        cashInput.value = currentCash + addVal;
      }
    } else if (mode === "round") {
      const roundTo = parseFloat(val) || 100;
      cashInput.value = Math.ceil(grandTotal / roundTo) * roundTo;
    }

    updateCashChange();
  }

  /**
   * Generates and renders a clean vector QR code for UPI payments via StockProQR.
   * @param {number} amount
   */
  function renderQRCode(amount) {
    const container = document.getElementById("pos-qr-code-container");
    if (!container || !window.StockProQR) return;

    const amt = (amount !== undefined ? amount : calculateBillSummary().grandTotal).toFixed(2);
    const invoiceId = getNextInvoiceId();
    const upiUrl = `upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=StockPro%20Retail&am=${amt}&cu=INR&tn=Bill%20${encodeURIComponent(invoiceId)}`;

    try {
      const svg = window.StockProQR.generateSVG(upiUrl, { size: 210, margin: 2 });
      container.innerHTML = svg;
    } catch (e) {
      console.error("Error generating QR code:", e);
      container.innerHTML = '<div style="color: var(--color-danger); font-size: 11px;">Error generating QR code</div>';
    }
  }

  /**
   * Completes the current sale, validates payment, deducts stock, persists invoice,
   * displays printable receipt modal, and resets POS state.
   */
  function completeSaleHandler() {
    if (posCart.length === 0) {
      alert("Current bill is empty! Please add at least one product before completing sale.");
      return;
    }

    const totals = calculateBillSummary();
    const grandTotal = totals.grandTotal;
    const customerNameInput = document.getElementById("bill-customer-name");
    const customerPhoneInput = document.getElementById("bill-customer-phone");
    const customerName = customerNameInput ? customerNameInput.value.trim() : "";
    const customerPhone = customerPhoneInput ? customerPhoneInput.value.trim() : "";

    let paymentDetails = {};

    if (selectedPaymentMethod === "cash") {
      const cashInput = document.getElementById("pos-cash-received");
      const cashVal = parseFloat(cashInput ? cashInput.value : 0);
      if (isNaN(cashVal) || cashVal < grandTotal) {
        const shortAmt = (grandTotal - (isNaN(cashVal) ? 0 : cashVal)).toFixed(2);
        alert(`Cash received is insufficient! The bill total is ${formatCurrency(grandTotal)}, but only ${formatCurrency(isNaN(cashVal) ? 0 : cashVal)} was entered (Short by ₹${shortAmt}).`);
        if (cashInput) cashInput.focus();
        return;
      }
      paymentDetails = {
        cashReceived: Number(cashVal.toFixed(2)),
        changeGiven: Number((cashVal - grandTotal).toFixed(2))
      };
    } else {
      // QR Code UPI
      paymentDetails = {
        upiId: merchantUpi,
        txnRef: "UPI-" + Date.now().toString().slice(-8),
        status: qrPaymentVerified ? "VERIFIED" : "PAID"
      };
    }

    // Deduct Inventory Stock with concurrency check
    let stockErrors = [];
    posCart.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) {
        stockErrors.push(`Product "${item.productName}" no longer exists in inventory.`);
      } else if (prod.stock < item.quantity) {
        stockErrors.push(`Insufficient stock for "${prod.name}" (Requested: ${item.quantity}, In Stock: ${prod.stock}).`);
      }
    });

    if (stockErrors.length > 0) {
      alert("Cannot complete sale due to stock conflicts:\n\n" + stockErrors.join("\n"));
      return;
    }

    // Apply stock deduction
    posCart.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock -= item.quantity;
        prod.updatedAt = new Date().toISOString();
      }
    });
    saveToStorage("products", products);

    // Customer save or update
    let customerId = null;
    if (customerName) {
      const existingCust = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
      if (existingCust) {
        customerId = existingCust.id;
        if (customerPhone) existingCust.phone = customerPhone;
      } else {
        customerId = "c_" + Date.now();
        customers.push({
          id: customerId,
          name: customerName,
          phone: customerPhone || "",
          address: "Retail Walk-in"
        });
      }
      saveToStorage("customers", customers);
      populateCustomerSuggestions();
    }

    // Create Invoice Record
    const invoiceId = getNextInvoiceId();
    const newInvoice = {
      id: invoiceId,
      customerId: customerId,
      customerName: customerName || "Walk-in Retail Customer",
      customerPhone: customerPhone || "N/A",
      date: new Date().toISOString(),
      items: posCart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        category: item.category || "General",
        price: item.price,
        quantity: item.quantity,
        total: item.total
      })),
      subtotal: Number(totals.subtotal.toFixed(2)),
      discountType: totals.discountType,
      discountValue: totals.discountValue,
      discountAmount: Number(totals.discountAmount.toFixed(2)),
      taxRate: totals.taxRate,
      taxAmount: Number(totals.taxAmount.toFixed(2)),
      total: Number(grandTotal.toFixed(2)),
      paymentMethod: selectedPaymentMethod,
      paymentDetails
    };

    invoices.unshift(newInvoice);
    saveToStorage("invoices", invoices);

    // Show printable receipt modal
    showReceiptModal(newInvoice);

    // Reset POS form & cart
    resetPosState();

    // Refresh all views
    renderAll();
  }

  /**
   * Resets the POS terminal inputs and cart back to default ready state.
   */
  function resetPosState() {
    posCart = [];
    const custName = document.getElementById("bill-customer-name");
    const custPhone = document.getElementById("bill-customer-phone");
    const prodSelect = document.getElementById("pos-product-select");
    const prodQty = document.getElementById("pos-product-qty");
    const discInput = document.getElementById("pos-discount-input");
    const cashInput = document.getElementById("pos-cash-received");
    const qrStatus = document.getElementById("qr-status-indicator");
    const qrText = document.getElementById("qr-status-text");

    if (custName) custName.value = "";
    if (custPhone) custPhone.value = "";
    if (prodSelect) prodSelect.value = "";
    if (prodQty) prodQty.value = "1";
    if (discInput) discInput.value = "0";
    if (cashInput) cashInput.value = "";

    qrPaymentVerified = false;
    if (qrStatus) qrStatus.className = "qr-status-box";
    if (qrText) qrText.textContent = "Awaiting Customer Scan...";

    updateNextInvoiceDisplay();
    renderPosCart();
    calculateBillSummary();
    renderPosProductSelect();
    renderQuickProductChips();
  }

  /**
   * Renders the printable tax invoice receipt inside #modal-receipt and opens the dialog.
   * @param {object} invoice
   */
  function showReceiptModal(invoice) {
    const area = document.getElementById("receipt-printable-area");
    if (!area) return;

    const cashier = (window.StockProAuth && window.StockProAuth.getUser() && window.StockProAuth.getUser().name) || "Administrator";
    const dateFormatted = new Date(invoice.date).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let itemsRows = "";
    invoice.items.forEach((it, idx) => {
      itemsRows += `
        <tr>
          <td style="width: 24px; color: #64748b;">${idx + 1}</td>
          <td>
            <strong>${escapeHTML(it.productName)}</strong>
            <div style="font-size: 10px; color: #64748b;">SKU: ${escapeHTML(it.sku)}</div>
          </td>
          <td style="text-align: center;">${it.quantity}</td>
          <td style="text-align: right;">${formatCurrency(it.price)}</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(it.total)}</td>
        </tr>
      `;
    });

    let paymentDetailsHtml = "";
    if (invoice.paymentMethod === "cash") {
      paymentDetailsHtml = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Payment Method:</span>
          <strong>Cash Payment</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Cash Tendered:</span>
          <strong>${formatCurrency(invoice.paymentDetails ? invoice.paymentDetails.cashReceived : invoice.total)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Change Returned:</span>
          <strong>${formatCurrency(invoice.paymentDetails ? invoice.paymentDetails.changeGiven : 0)}</strong>
        </div>
      `;
    } else {
      paymentDetailsHtml = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Payment Method:</span>
          <strong>UPI / QR Code</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Merchant VPA:</span>
          <code style="font-family: monospace;">${escapeHTML(invoice.paymentDetails ? invoice.paymentDetails.upiId : merchantUpi)}</code>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Transaction Ref:</span>
          <code style="font-family: monospace;">${escapeHTML(invoice.paymentDetails ? invoice.paymentDetails.txnRef : 'UPI-VERIFIED')}</code>
        </div>
      `;
    }

    let verificationQrSvg = "";
    if (window.StockProQR) {
      const verifyText = `StockPro Invoice: ${invoice.id} | Date: ${invoice.date} | Amount: ${formatCurrency(invoice.total)} | Status: PAID`;
      verificationQrSvg = window.StockProQR.generateSVG(verifyText, { size: 90, margin: 1 });
    }

    area.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-brand-title">STOCKPRO RETAIL</div>
        <div class="receipt-subtext">Tax Invoice / Retail Bill</div>
        <div class="receipt-subtext">GSTIN: 27AABCS1429B1Z | Phone: +91 98765 43210</div>
        <div class="receipt-subtext">100 Tech Hub Blvd, Suite 402, Mumbai, MH</div>
      </div>

      <div class="receipt-meta-grid">
        <div class="receipt-meta-item">
          <strong>Invoice #:</strong> ${escapeHTML(invoice.id)}
        </div>
        <div class="receipt-meta-item" style="text-align: right;">
          <strong>Date:</strong> ${dateFormatted}
        </div>
        <div class="receipt-meta-item">
          <strong>Customer:</strong> ${escapeHTML(invoice.customerName)}
        </div>
        <div class="receipt-meta-item" style="text-align: right;">
          <strong>Contact:</strong> ${escapeHTML(invoice.customerPhone)}
        </div>
        <div class="receipt-meta-item">
          <strong>Cashier:</strong> ${escapeHTML(cashier)}
        </div>
        <div class="receipt-meta-item" style="text-align: right;">
          <strong>Status:</strong> <span style="color: #10b981; font-weight: 700;">PAID</span>
        </div>
      </div>

      <table class="receipt-items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="receipt-totals-section">
        <div class="receipt-total-row">
          <span>Subtotal:</span>
          <strong>${formatCurrency(invoice.subtotal)}</strong>
        </div>
        ${invoice.discountAmount > 0 ? `
          <div class="receipt-total-row">
            <span>Discount (${invoice.discountType === 'percent' ? invoice.discountValue + '%' : 'Flat'}):</span>
            <strong style="color: #ef4444;">-${formatCurrency(invoice.discountAmount)}</strong>
          </div>
        ` : ''}
        <div class="receipt-total-row">
          <span>GST / Tax (${invoice.taxRate}%):</span>
          <strong>+${formatCurrency(invoice.taxAmount)}</strong>
        </div>
        <div class="receipt-total-row grand-total">
          <span>Grand Total:</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
      </div>

      <div class="receipt-payment-info">
        ${paymentDetailsHtml}
      </div>

      <div class="receipt-footer">
        <div class="receipt-footer-msg">Thank you for shopping with us!</div>
        <div style="font-size: 10px; color: #64748b;">Terms: Goods once sold can be exchanged within 7 days with this bill.</div>
        ${verificationQrSvg ? `
          <div class="receipt-qr-box">
            ${verificationQrSvg}
            <span>Scan to Verify Invoice Authenticity</span>
          </div>
        ` : ''}
      </div>
    `;

    openModal("modal-receipt");
  }

  /**
   * Renders the Invoices History view, KPI summary cards, and filters.
   */
  function renderInvoicesHistory() {
    const badge = document.getElementById("history-count-badge");
    if (badge) badge.textContent = invoices.length;

    const totalCountElem = document.getElementById("stat-invoices-count");
    const totalSalesElem = document.getElementById("stat-total-sales");
    const cashSalesElem = document.getElementById("stat-cash-sales");
    const qrSalesElem = document.getElementById("stat-qr-sales");

    const totalInvoicesCount = invoices.length;
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const cashRevenue = invoices.filter(inv => inv.paymentMethod === "cash").reduce((sum, inv) => sum + (inv.total || 0), 0);
    const qrRevenue = invoices.filter(inv => inv.paymentMethod === "qrcode").reduce((sum, inv) => sum + (inv.total || 0), 0);

    if (totalCountElem) totalCountElem.textContent = totalInvoicesCount;
    if (totalSalesElem) totalSalesElem.textContent = formatCurrency(totalRevenue);
    if (cashSalesElem) cashSalesElem.textContent = formatCurrency(cashRevenue);
    if (qrSalesElem) qrSalesElem.textContent = formatCurrency(qrRevenue);

    const searchInput = document.getElementById("history-search");
    const filterMethod = document.getElementById("history-filter-method");
    const tbody = document.getElementById("invoices-tbody");
    if (!tbody) return;

    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const methodFilter = filterMethod ? filterMethod.value : "all";

    const filtered = invoices.filter(inv => {
      if (methodFilter !== "all" && inv.paymentMethod !== methodFilter) {
        return false;
      }
      if (query) {
        const idMatch = inv.id && inv.id.toLowerCase().includes(query);
        const nameMatch = inv.customerName && inv.customerName.toLowerCase().includes(query);
        const phoneMatch = inv.customerPhone && inv.customerPhone.toLowerCase().includes(query);
        return idMatch || nameMatch || phoneMatch;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 32px 10px;">
            ${invoices.length === 0 ? 'No invoices recorded yet. Create a bill from POS to see history.' : 'No invoices matching filter criteria.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = "";
    filtered.forEach(inv => {
      const tr = document.createElement("tr");

      const dateStr = inv.date ? new Date(inv.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
      const itemsCount = inv.items ? inv.items.reduce((s, it) => s + (it.quantity || 1), 0) : 0;
      const itemsTypes = inv.items ? inv.items.length : 0;

      const isCash = inv.paymentMethod === "cash";
      const methodBadge = isCash
        ? `<span class="invoice-badge-cash"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg> Cash</span>`
        : `<span class="invoice-badge-qr"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> QR UPI</span>`;

      tr.innerHTML = `
        <td style="font-family: monospace; font-weight: 700; color: var(--color-primary-light);">${escapeHTML(inv.id)}</td>
        <td style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">${escapeHTML(dateStr)}</td>
        <td>
          <div style="font-weight: 600;">${escapeHTML(inv.customerName || 'Walk-in')}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(inv.customerPhone || '')}</div>
        </td>
        <td>
          <span class="badge badge-info" style="font-size: 11px;">${itemsTypes} item${itemsTypes === 1 ? '' : 's'} (${itemsCount} units)</span>
        </td>
        <td>${methodBadge}</td>
        <td style="font-weight: 700; font-size: 14px; color: var(--text-primary); white-space: nowrap;">
          ${formatCurrency(inv.total)}
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-action-icon btn-view-invoice" data-id="${inv.id}" title="View & Print Receipt">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </button>
            <button type="button" class="btn-action-icon danger btn-delete-invoice" data-id="${inv.id}" title="Delete Invoice Record">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /**
   * Exports the entire invoices dataset as a formatted JSON backup file.
   */
  function exportInvoicesHandler() {
    const backupData = {
      invoices,
      exportDate: new Date().toISOString(),
      count: invoices.length,
      source: "StockPro Billing & Invoicing Engine"
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stockpro_invoices_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Master renderer for the Billing and POS system.
   */
  function renderBilling() {
    updateNextInvoiceDisplay();
    populateCustomerSuggestions();
    renderPosProductSelect();
    renderQuickProductChips();
    renderPosCart();
    calculateBillSummary();
    renderInvoicesHistory();
  }

  // --- EVENT LISTENERS INITIALIZATION ---
  /**
   * Attaches all application event listeners including:
   * - Sidebar and mobile bottom navigation links
   * - Mobile navigation drawer toggle and backdrop dismiss
   * - Quick jump navigation buttons
   * - Modal close buttons and outside overlay click detection
   * - Product add / edit form triggers and submissions
   * - Live inventory search, category filters, and status filters
   * - Delegated table actions (edit product, delete product)
   * - Inventory backup export and JSON backup file import
   */
  function setupEventListeners() {
    // 1. Desktop Sidebar Navigation Clicks
    document.querySelectorAll(".sidebar-menu li").forEach(li => {
      li.addEventListener("click", (e) => {
        e.preventDefault();
        const target = li.getAttribute("data-target");
        if (target) switchTab(target);
      });
    });

    // 2. Mobile Bottom Navigation Clicks
    document.querySelectorAll(".mobile-bottom-nav .mobile-nav-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = btn.getAttribute("data-target");
        if (target) switchTab(target);
      });
    });

    // 3. Mobile Hamburger Menu Toggle
    const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener("click", () => {
        openMobileSidebar();
      });
    }

    // 4. Mobile Close Drawer Button
    const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener("click", () => {
        closeMobileSidebar();
      });
    }

    // 5. Sidebar Backdrop Click
    const sidebarBackdrop = document.getElementById("sidebar-backdrop");
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener("click", () => {
        closeMobileSidebar();
      });
    }

    // 6. Quick Jump links (e.g. View All in Dashboard)
    document.querySelectorAll(".nav-jump-btn").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = link.getAttribute("data-target");
        if (target) switchTab(target);
      });
    });


    // 8. Close Modal buttons
    document.querySelectorAll(".modal-close-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-modal");
        if (modalId) closeModal(modalId);
      });
    });

    // 9. Close modal when clicking outside modal-container
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.remove("active");
        }
      });
    });

    // 10. Product Form Submission prevention
    const productForm = document.getElementById("product-form");
    if (productForm) {
      productForm.addEventListener("submit", (e) => e.preventDefault());
    }

    // 11. Add Product Trigger
    const btnAddProduct = document.getElementById("btn-add-product");
    if (btnAddProduct) {
      btnAddProduct.addEventListener("click", () => {
        if (productForm) productForm.reset();
        document.getElementById("product-id").value = "";
        document.getElementById("product-modal-title").textContent = "Add New Product";
        openModal("modal-product");
      });
    }

    // 12. Save Product Click
    const btnSaveProduct = document.getElementById("btn-save-product");
    if (btnSaveProduct) {
      btnSaveProduct.addEventListener("click", () => {
        saveProductHandler();
      });
    }

    // 13. Inventory Search & Filters
    const invSearch = document.getElementById("inventory-search");
    if (invSearch) invSearch.addEventListener("input", renderInventory);

    const invCatFilter = document.getElementById("inventory-filter-category");
    if (invCatFilter) invCatFilter.addEventListener("change", renderInventory);

    const invStatusFilter = document.getElementById("inventory-filter-status");
    if (invStatusFilter) invStatusFilter.addEventListener("change", renderInventory);

    // 14. Inventory Table Action Buttons (Edit / Delete)
    const invTbody = document.getElementById("inventory-tbody");
    if (invTbody) {
      invTbody.addEventListener("click", (e) => {
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
          if (confirm("Are you sure you want to delete this product?")) {
            products = products.filter(p => p.id !== prodId);
            saveToStorage("products", products);
            renderCategoryDropdowns();
            renderAll();
          }
        }
      });
    }

    // 15. Inventory Data Export
    const btnExport = document.getElementById("btn-export-db");
    if (btnExport) {
      btnExport.addEventListener("click", () => {
        const backupData = {
          products,
          exportDate: new Date().toISOString(),
          version: "2.0",
          source: "localStorage"
        };
        
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stockpro_inventory_backup_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // 16. Inventory Data Import (JSON file to localStorage)
    const importInput = document.getElementById("import-file-input");
    if (importInput) {
      importInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            let importedProducts = null;

            if (Array.isArray(imported)) {
              importedProducts = imported;
            } else if (imported && Array.isArray(imported.products)) {
              importedProducts = imported.products;
            }

            if (importedProducts) {
              if (confirm("Importing backup data will replace your current local inventory. Continue?")) {
                products = importedProducts;
                saveToStorage("products", products);
                renderCategoryDropdowns();
                renderAll();
                alert("Inventory data successfully imported into local storage!");
              }
            } else {
              alert("Invalid backup file format. Expected a JSON file with an array of products.");
            }
          } catch (err) {
            alert("Error reading backup file: " + err.message);
          }
          importInput.value = "";
        };
        reader.readAsText(file);
      });
    }

    // =========================================================================
    // 17. BILLING & POS EVENT LISTENERS
    // =========================================================================

    // A. Sub-Navigation Tabs (POS vs History)
    const tabPos = document.getElementById("billing-tab-pos");
    const tabHistory = document.getElementById("billing-tab-history");
    const viewPos = document.getElementById("billing-view-pos");
    const viewHistory = document.getElementById("billing-view-history");

    if (tabPos && tabHistory && viewPos && viewHistory) {
      tabPos.addEventListener("click", () => {
        tabPos.classList.add("active");
        tabHistory.classList.remove("active");
        viewPos.classList.add("active");
        viewHistory.classList.remove("active");
        updateNextInvoiceDisplay();
        renderPosProductSelect();
        renderQuickProductChips();
      });

      tabHistory.addEventListener("click", () => {
        tabHistory.classList.add("active");
        tabPos.classList.remove("active");
        viewHistory.classList.add("active");
        viewPos.classList.remove("active");
        renderInvoicesHistory();
      });
    }

    // B. Customer Autocomplete
    const custNameInput = document.getElementById("bill-customer-name");
    if (custNameInput) {
      custNameInput.addEventListener("input", (e) => {
        handleCustomerNameInput(e.target.value);
      });
      custNameInput.addEventListener("change", (e) => {
        handleCustomerNameInput(e.target.value);
      });
    }

    // C. Product Select Change
    const prodSelect = document.getElementById("pos-product-select");
    if (prodSelect) {
      prodSelect.addEventListener("change", () => {
        updatePosStockAvail();
      });
    }

    // D. Add Item to Bill Button
    const btnAddItem = document.getElementById("btn-add-item-to-bill");
    if (btnAddItem) {
      btnAddItem.addEventListener("click", () => {
        const pSelect = document.getElementById("pos-product-select");
        const pQty = document.getElementById("pos-product-qty");
        if (!pSelect || !pSelect.value) {
          alert("Please select a product to add to the bill.");
          return;
        }
        const qty = parseInt(pQty ? pQty.value : 1, 10) || 1;
        addItemToCart(pSelect.value, qty);
        pSelect.value = "";
        if (pQty) pQty.value = "1";
        updatePosStockAvail();
      });
    }

    // E. Cart Table Actions (Delegated: Qty minus, plus, edit, and remove)
    const cartTbody = document.getElementById("pos-items-tbody");
    if (cartTbody) {
      cartTbody.addEventListener("click", (e) => {
        const minusBtn = e.target.closest(".btn-qty-minus");
        const plusBtn = e.target.closest(".btn-qty-plus");
        const removeBtn = e.target.closest(".btn-item-remove");

        if (minusBtn) {
          const prodId = minusBtn.getAttribute("data-id");
          const item = posCart.find(i => i.productId === prodId);
          if (item) {
            updateCartItemQty(prodId, item.quantity - 1);
          }
        } else if (plusBtn) {
          const prodId = plusBtn.getAttribute("data-id");
          const item = posCart.find(i => i.productId === prodId);
          if (item) {
            updateCartItemQty(prodId, item.quantity + 1);
          }
        } else if (removeBtn) {
          const prodId = removeBtn.getAttribute("data-id");
          if (prodId) {
            removeCartItem(prodId);
          }
        }
      });

      cartTbody.addEventListener("change", (e) => {
        if (e.target.classList.contains("cart-qty-input")) {
          const prodId = e.target.getAttribute("data-id");
          const newQty = parseInt(e.target.value, 10);
          updateCartItemQty(prodId, newQty);
        }
      });
    }

    // F. Clear Cart Button
    const btnClearCart = document.getElementById("btn-clear-cart");
    if (btnClearCart) {
      btnClearCart.addEventListener("click", () => {
        clearCart();
      });
    }

    // G. Discount & Tax Inputs
    const discTypeSelect = document.getElementById("pos-discount-type");
    if (discTypeSelect) {
      discTypeSelect.addEventListener("change", () => calculateBillSummary());
    }

    const discInput = document.getElementById("pos-discount-input");
    if (discInput) {
      discInput.addEventListener("input", () => calculateBillSummary());
    }

    const taxSelect = document.getElementById("pos-tax-select");
    if (taxSelect) {
      taxSelect.addEventListener("change", () => calculateBillSummary());
    }

    // H. Payment Method Switcher (Cash vs QR)
    const payOptCash = document.getElementById("pay-opt-cash");
    const payOptQr = document.getElementById("pay-opt-qr");
    const panelPayCash = document.getElementById("panel-pay-cash");
    const panelPayQr = document.getElementById("panel-pay-qr");

    if (payOptCash && payOptQr && panelPayCash && panelPayQr) {
      payOptCash.addEventListener("click", () => {
        payOptCash.classList.add("active");
        payOptQr.classList.remove("active");
        panelPayCash.classList.add("active");
        panelPayQr.classList.remove("active");
        selectedPaymentMethod = "cash";
        updateCashChange();
      });

      payOptQr.addEventListener("click", () => {
        payOptQr.classList.add("active");
        payOptCash.classList.remove("active");
        panelPayQr.classList.add("active");
        panelPayCash.classList.remove("active");
        selectedPaymentMethod = "qrcode";
        const totals = calculateBillSummary();
        renderQRCode(totals.grandTotal);
      });
    }

    // I. Cash Received Input & Preset Buttons
    const cashInput = document.getElementById("pos-cash-received");
    if (cashInput) {
      cashInput.addEventListener("input", () => {
        updateCashChange();
      });
    }

    document.querySelectorAll(".btn-preset-cash").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        const add = btn.getAttribute("data-add");
        const round = btn.getAttribute("data-round");

        if (mode === "exact") {
          handleCashPreset("exact", null);
        } else if (add) {
          handleCashPreset("add", add);
        } else if (round) {
          handleCashPreset("round", round);
        }
      });
    });

    // J. QR UPI Merchant Configuration & Simulation
    const btnEditUpi = document.getElementById("btn-edit-upi");
    const upiEditBox = document.getElementById("upi-edit-box");
    const customUpiInput = document.getElementById("pos-custom-upi");
    const merchantUpiText = document.getElementById("pos-merchant-upi");

    if (btnEditUpi && upiEditBox) {
      btnEditUpi.addEventListener("click", () => {
        const isHidden = upiEditBox.style.display === "none";
        upiEditBox.style.display = isHidden ? "block" : "none";
        btnEditUpi.textContent = isHidden ? "(Close)" : "(Edit)";
      });
    }

    if (customUpiInput) {
      customUpiInput.value = merchantUpi;
      if (merchantUpiText) merchantUpiText.textContent = merchantUpi;

      customUpiInput.addEventListener("change", (e) => {
        const val = e.target.value.trim();
        if (val) {
          merchantUpi = val;
          localStorage.setItem("stockpro_upi", merchantUpi);
          if (merchantUpiText) merchantUpiText.textContent = merchantUpi;
          const totals = calculateBillSummary();
          renderQRCode(totals.grandTotal);
        }
      });
    }

    const btnSimulateQr = document.getElementById("btn-simulate-qr-paid");
    if (btnSimulateQr) {
      btnSimulateQr.addEventListener("click", () => {
        qrPaymentVerified = true;
        const statusBox = document.getElementById("qr-status-indicator");
        const statusText = document.getElementById("qr-status-text");
        if (statusBox) statusBox.className = "qr-status-box verified";
        if (statusText) statusText.textContent = "✓ QR Payment Verified & Received!";
      });
    }

    // K. Complete Sale & Reset Buttons
    const btnCompleteSale = document.getElementById("btn-complete-sale");
    if (btnCompleteSale) {
      btnCompleteSale.addEventListener("click", () => {
        completeSaleHandler();
      });
    }

    const btnResetPos = document.getElementById("btn-reset-pos");
    if (btnResetPos) {
      btnResetPos.addEventListener("click", () => {
        if (posCart.length > 0) {
          if (confirm("Reset and clear current bill?")) {
            resetPosState();
          }
        } else {
          resetPosState();
        }
      });
    }

    // L. Invoices History Search & Filter
    const histSearch = document.getElementById("history-search");
    if (histSearch) {
      histSearch.addEventListener("input", () => renderInvoicesHistory());
    }

    const histFilterMethod = document.getElementById("history-filter-method");
    if (histFilterMethod) {
      histFilterMethod.addEventListener("change", () => renderInvoicesHistory());
    }

    // M. Invoices History Table Actions (View / Print, Delete)
    const invoicesTbody = document.getElementById("invoices-tbody");
    if (invoicesTbody) {
      invoicesTbody.addEventListener("click", (e) => {
        const viewBtn = e.target.closest(".btn-view-invoice");
        const deleteBtn = e.target.closest(".btn-delete-invoice");

        if (viewBtn) {
          const invId = viewBtn.getAttribute("data-id");
          const inv = invoices.find(i => i.id === invId);
          if (inv) {
            showReceiptModal(inv);
          }
        } else if (deleteBtn) {
          const invId = deleteBtn.getAttribute("data-id");
          if (confirm(`Are you sure you want to permanently delete invoice ${invId}?`)) {
            invoices = invoices.filter(i => i.id !== invId);
            saveToStorage("invoices", invoices);
            renderInvoicesHistory();
          }
        }
      });
    }

    // N. Invoices Export
    const btnExportInvoices = document.getElementById("btn-export-invoices");
    if (btnExportInvoices) {
      btnExportInvoices.addEventListener("click", () => {
        exportInvoicesHandler();
      });
    }

    // O. Print Receipt Button in Modal
    const btnPrintReceipt = document.getElementById("btn-print-receipt");
    if (btnPrintReceipt) {
      btnPrintReceipt.addEventListener("click", () => {
        window.print();
      });
    }

    // 18. Listen for Auth Events (Login / Logout - local session sync)
    window.addEventListener('auth:login', () => {
      const savedProducts = getFromStorage("products", []);
      if (savedProducts && savedProducts.length > 0) {
        products = savedProducts;
      }
      const savedCustomers = getFromStorage("customers", []);
      if (savedCustomers && savedCustomers.length > 0) {
        customers = savedCustomers;
      }
      const savedInvoices = getFromStorage("invoices", []);
      if (savedInvoices && savedInvoices.length > 0) {
        invoices = savedInvoices;
      }
      renderCategoryDropdowns();
      renderAll();
    });

    window.addEventListener('auth:logout', () => {
      renderCategoryDropdowns();
      renderAll();
    });
  }

  // --- UTILITY FUNCTIONS ---
  /**
   * Sanitizes text strings by escaping special HTML characters (&, <, >, ', ")
   * to protect against Cross-Site Scripting (XSS) when outputting dynamic content into innerHTML.
   * @param {string} str - Raw input string to escape.
   * @returns {string} Sanitized string safe for HTML injection.
   */
  function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  // Window resize handler: redraw SVG chart responsively (debounced by 150ms)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const dashSection = document.getElementById("section-dashboard");
      if (dashSection && dashSection.classList.contains("active")) {
        drawCategoryChart();
      }
    }, 150);
  });

  // Start initialization
  init();
});
