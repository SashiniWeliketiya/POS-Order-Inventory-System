import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = "https://pos-backend-mc643n9oc-sashini.vercel.app/api/products";

export default function App() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 Minutes in seconds
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // New Product Form
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');

  const fetchData = async () => {
    try {
      const [prodRes, orderRes] = await Promise.all([
        axios.get(`${API_BASE}/products`),
        axios.get(`${API_BASE}/orders`)
      ]);
      setProducts(prodRes.data);
      setOrders(orderRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // 5-Minute Countdown Logic
  useEffect(() => {
    let timer;
    if (activeOrder && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && activeOrder) {
      setMessage('Reservation expired! Stock released automatically.');
      setActiveOrder(null);
      fetchData();
    }
    return () => clearInterval(timer);
  }, [activeOrder, timeLeft]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!name || !price || !stock) return alert('Fill all product fields!');
    try {
      await axios.post(`${API_BASE}/products`, { name, price: Number(price), stock: Number(stock) });
      setName(''); setPrice(''); setStock('');
      setMessage('Product added successfully!');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add product');
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.productId === product._id);
    if (existing) {
      if (existing.quantity + 1 > product.availableStock) return alert('Stock limit reached!');
      setCart(cart.map(item => item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      if (product.availableStock < 1) return alert('Out of stock!');
      setCart([...cart, { productId: product._id, name: product.name, price: product.price, quantity: 1 }]);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/orders/reserve`, {
        idempotencyKey: `cart-${Date.now()}`,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity }))
      });
      setActiveOrder(res.data.order);
      setTimeLeft(300); // Reset timer to 5 mins
      setCart([]);
      setMessage('Stock Reserved! Complete payment within 5 minutes.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Reservation failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (outcome) => {
    if (!activeOrder) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/orders/pay`, {
        orderId: activeOrder._id,
        paymentOutcome: outcome
      });
      setMessage(res.data.message);
      setActiveOrder(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Payment process failed');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ padding: '30px', fontFamily: "'Segoe UI', Roboto, sans-serif", maxWidth: '1200px', margin: '0 auto', color: '#2c3e50', backgroundColor: '#f4f6f9', minHeight: '100vh' }}>
      
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '30px', background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h1 style={{ margin: 0, fontSize: '28px', color: '#1e293b' }}>Smart POS & Inventory System</h1>
        <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '14px' }}>Concurrency-Safe Stock Reservation • Mock Payments • Order Lifecycle Management</p>
      </header>

      {message && (
        <div style={{ padding: '14px', background: '#e0f2fe', color: '#0369a1', borderLeft: '5px solid #0284c7', borderRadius: '6px', marginBottom: '25px', fontWeight: '500' }}>
          {message}
        </div>
      )}

      {/* Add Product Section */}
      <section style={{ background: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>Add New Product to Inventory</h3>
        <form onSubmit={handleAddProduct} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '15px' }}>
          <input type="text" placeholder="Product Name" value={name} onChange={e => setName(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          <input type="number" placeholder="Price (LKR)" value={price} onChange={e => setPrice(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          <input type="number" placeholder="Stock Quantity" value={stock} onChange={e => setStock(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          <button type="submit" style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>+ Add Item</button>
        </form>
      </section>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', marginBottom: '30px' }}>
        
        {/* Products List */}
        <section>
          <h3 style={{ margin: '0 0 15px 0' }}>Live Inventory Products</h3>
          {products.length === 0 ? <p style={{ color: '#94a3b8' }}>No items in inventory.</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
              {products.map(p => (
                <div key={p._id} style={{ background: '#fff', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{p.name}</h4>
                  <div style={{ fontSize: '14px', color: '#475569', marginBottom: '12px' }}>
                    <div>Price: <strong>LKR {p.price}</strong></div>
                    <div>Total Base Stock: {p.totalStock}</div>
                    <div style={{ marginTop: '4px', fontWeight: 'bold', color: p.availableStock > 0 ? '#16a34a' : '#dc2626' }}>
                      Available Stock: {p.availableStock}
                    </div>
                  </div>
                  <button 
                    disabled={p.availableStock <= 0} 
                    onClick={() => addToCart(p)}
                    style={{ width: '100%', padding: '9px', background: p.availableStock > 0 ? '#059669' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: p.availableStock > 0 ? 'pointer' : 'not-allowed' }}
                  >
                    {p.availableStock > 0 ? 'Add to Cart' : 'Out of Stock'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cart & Active Order */}
        <section>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Current Cart</h3>
            {cart.length === 0 ? <p style={{ color: '#94a3b8' }}>Cart is empty</p> : (
              <div>
                {cart.map(item => (
                  <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                    <span>{item.name} × {item.quantity}</span>
                    <span style={{ fontWeight: '600' }}>LKR {item.price * item.quantity}</span>
                  </div>
                ))}
                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '15px 0' }} />
                <button 
                  onClick={handleCheckout} 
                  disabled={loading}
                  style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Reserve Stock & Checkout
                </button>
              </div>
            )}
          </div>

          {/* Countdown & Mock Payment Modal */}
          {activeOrder && (
            <div style={{ marginTop: '20px', background: '#fffbe8', border: '2px solid #fde047', padding: '20px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: '#854d0e' }}>Payment Gateway Simulator</h4>
                <span style={{ background: '#fef08a', color: '#854d0e', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                  Timer: {formatTime(timeLeft)}
                </span>
              </div>

              <p style={{ fontSize: '13px', margin: '5px 0' }}>Status: <strong>{activeOrder.status}</strong></p>
              <p style={{ fontSize: '15px', margin: '5px 0 15px 0' }}>Total Amount: <strong>LKR {activeOrder.totalAmount}</strong></p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => handlePayment('success')} disabled={loading} style={{ padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                  Simulate Payment Success
                </button>
                <button onClick={() => handlePayment('failure')} disabled={loading} style={{ padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                  Simulate Payment Failure
                </button>
                <button onClick={() => handlePayment('timeout')} disabled={loading} style={{ padding: '10px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                  Simulate Payment Timeout
                </button>
              </div>
            </div>
          )}
        </section>

      </div>

      {/* Order Audit History Table */}
      <section style={{ background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 15px 0' }}>Order Audit History & Lifecycle Log</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '10px' }}>Order ID</th>
              <th style={{ padding: '10px' }}>Total Amount</th>
              <th style={{ padding: '10px' }}>Status</th>
              <th style={{ padding: '10px' }}>Created Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>{o._id}</td>
                <td style={{ padding: '10px' }}>LKR {o.totalAmount}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    background: o.status === 'PAID' ? '#dcfce7' : o.status === 'RESERVED' ? '#fef9c3' : '#fee2e2',
                    color: o.status === 'PAID' ? '#15803d' : o.status === 'RESERVED' ? '#a16207' : '#b91c1c'
                  }}>
                    {o.status}
                  </span>
                </td>
                <td style={{ padding: '10px', color: '#64748b' }}>{new Date(o.createdAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

    </div>
  );
}