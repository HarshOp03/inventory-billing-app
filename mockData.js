// Mock Data to bootstrap the application on first launch
const initialProducts = [
  { id: "p1", name: "Premium Wireless Headphones", sku: "WHEAD-001", category: "Electronics", price: 129.99, stock: 45, reorderLevel: 10 },
  { id: "p2", name: "Ergonomic Office Chair", sku: "OCHAR-042", category: "Office Furniture", price: 249.50, stock: 8, reorderLevel: 5 },
  { id: "p3", name: "Ultra-wide Gaming Monitor", sku: "MON-34UW", category: "Electronics", price: 399.99, stock: 3, reorderLevel: 5 }, // Low stock trigger
  { id: "p4", name: "Mechanical Keyboard (Blue Switch)", sku: "KBD-MECH87", category: "Computer Accessories", price: 89.00, stock: 22, reorderLevel: 8 },
  { id: "p5", name: "Cork Yoga Mat (6mm)", sku: "YOGA-CORK", category: "Fitness", price: 45.00, stock: 15, reorderLevel: 4 },
  { id: "p6", name: "Double-walled Travel Mug", sku: "MUG-TRAV01", category: "Kitchenware", price: 24.95, stock: 50, reorderLevel: 12 }
];

const initialCustomers = [
  { id: "c1", name: "Alice Johnson", email: "alice.j@example.com", phone: "+1 (555) 234-5678", address: "123 Maple Street, Springfield" },
  { id: "c2", name: "Robert Smith", email: "robert.s@outlook.com", phone: "+1 (555) 876-5432", address: "456 Oak Avenue, Metropolis" },
  { id: "c3", name: "TechCorp Solutions", email: "procurement@techcorp.com", phone: "+1 (800) 555-0199", address: "789 Enterprise Blvd, Suite 400, Silicon Valley" }
];

const initialInvoices = [
  {
    id: "INV-2026-0001",
    customerId: "c1",
    customerName: "Alice Johnson",
    date: "2026-08-10T14:30:00.000Z",
    items: [
      { productId: "p1", productName: "Premium Wireless Headphones", price: 129.99, quantity: 1, total: 129.99 },
      { productId: "p6", productName: "Double-walled Travel Mug", price: 24.95, quantity: 2, total: 49.90 }
    ],
    subtotal: 179.89,
    taxRate: 10,
    taxAmount: 17.99,
    discountRate: 5,
    discountAmount: 9.00,
    total: 188.88
  },
  {
    id: "INV-2026-0002",
    customerId: "c3",
    customerName: "TechCorp Solutions",
    date: "2026-08-18T10:15:00.000Z",
    items: [
      { productId: "p2", productName: "Ergonomic Office Chair", price: 249.50, quantity: 4, total: 998.00 },
      { productId: "p4", productName: "Mechanical Keyboard (Blue Switch)", price: 89.00, quantity: 5, total: 445.00 }
    ],
    subtotal: 1443.00,
    taxRate: 10,
    taxAmount: 144.30,
    discountRate: 10,
    discountAmount: 144.30,
    total: 1443.00
  },
  {
    id: "INV-2026-0003",
    customerId: "c2",
    customerName: "Robert Smith",
    date: "2026-08-22T16:45:00.000Z",
    items: [
      { productId: "p5", productName: "Cork Yoga Mat (6mm)", price: 45.00, quantity: 2, total: 90.00 }
    ],
    subtotal: 90.00,
    taxRate: 10,
    taxAmount: 9.00,
    discountRate: 0,
    discountAmount: 0.00,
    total: 99.00
  }
];

// Export to window if running in browser
if (typeof window !== 'undefined') {
  window.initialProducts = initialProducts;
  window.initialCustomers = initialCustomers;
  window.initialInvoices = initialInvoices;
}
